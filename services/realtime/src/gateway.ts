import Fastify, { type FastifyRequest } from 'fastify';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { config } from '@huddly/config';
import { prisma } from '@huddly/database';
import {
  validateEventWithPayload,
  PROTOCOL_VERSION,
  type EventEnvelope,
  type RoomStateSnapshotPayload,
  type PlaybackSnapshot,
  type PresenceUpdatedPayload,
} from '@huddly/protocol';

export const AuthenticatedClientContextSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().min(1).max(50),
  roomId: z.string().uuid(),
  memberId: z.string().uuid(),
  role: z.enum(['HOST', 'PARTICIPANT']),
});

export type AuthenticatedClientContext = z.infer<typeof AuthenticatedClientContextSchema>;

export interface SocketMetadata {
  context: AuthenticatedClientContext;
  missedPongs: number;
  rateLimit: { count: number; resetAt: number };
}

export interface GatewayState {
  roomSockets: Map<string, Set<WebSocket>>;
  socketMetadata: Map<WebSocket, SocketMetadata>;
}

export interface PlaybackStateStore {
  mediaId: string;
  mediaUrl: string;
  position: number;
  playing: boolean;
  playbackRate: number;
  revision: number;
  serverTimestamp: number;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_MISSED_PONGS = 2;
const MAX_EVENTS_PER_SECOND = 25;

export async function buildGatewayApp(opts?: {
  redisPubSub?: Redis;
  redisState?: Redis;
  heartbeatIntervalMs?: number;
}) {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  // Register WebSocket plugin with 64KB maxPayload limit to prevent large frame attacks
  await app.register(websocket, {
    options: {
      maxPayload: 64 * 1024,
    },
  });

  const redisPubSub = opts?.redisPubSub || new Redis(config.REDIS_PUBSUB_URL);
  const redisSub = redisPubSub.duplicate();
  const redisState = opts?.redisState || new Redis(config.REDIS_STATE_URL);

  const state: GatewayState = {
    roomSockets: new Map(),
    socketMetadata: new Map(),
  };

  // Listen for incoming pub/sub messages across gateway nodes
  redisSub.on('message', (channel: string, messageStr: string) => {
    const roomId = channel.replace(/^room:/, '');
    const sockets = state.roomSockets.get(roomId);
    if (!sockets || sockets.size === 0) return;

    for (const socket of sockets) {
      if (socket.readyState === 1 /* OPEN */) {
        socket.send(messageStr);
      }
    }
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // WebSocket Ingress
  app.get('/ws', { websocket: true }, async (socket: WebSocket, req: FastifyRequest) => {
    const hostHeader = (req.headers['host'] as string) || 'localhost';
    const url = new URL(req.url, `http://${hostHeader}`);
    const ticket = url.searchParams.get('ticket');

    if (!ticket) {
      socket.close(4401, 'Unauthorized: Missing connection ticket');
      return;
    }

    // Atomic ticket consumption (GETDEL) from Redis State instance
    let ticketJson: string | null;
    try {
      ticketJson = await redisState.getdel(`ticket:${ticket}`);
    } catch {
      ticketJson = null;
    }

    if (!ticketJson) {
      socket.close(4401, 'Unauthorized: Invalid or expired connection ticket');
      return;
    }

    let parsedTicket: unknown;
    try {
      parsedTicket = JSON.parse(ticketJson);
    } catch {
      socket.close(4400, 'Invalid ticket payload structure');
      return;
    }

    const contextValidation = AuthenticatedClientContextSchema.safeParse(parsedTicket);
    if (!contextValidation.success) {
      socket.close(4400, 'Invalid ticket payload structure');
      return;
    }

    const clientCtx = contextValidation.data;
    const { roomId } = clientCtx;

    // Register socket
    if (!state.roomSockets.has(roomId)) {
      state.roomSockets.set(roomId, new Set());
      await redisSub.subscribe(`room:${roomId}`);
    }
    state.roomSockets.get(roomId)!.add(socket);

    state.socketMetadata.set(socket, {
      context: clientCtx,
      missedPongs: 0,
      rateLimit: { count: 0, resetAt: Date.now() + 1000 },
    });

    // Handle WebSocket Pong heartbeat
    socket.on('pong', () => {
      const meta = state.socketMetadata.get(socket);
      if (meta) {
        meta.missedPongs = 0;
      }
    });

    // Build authoritative Room State Snapshot from Redis + PostgreSQL
    let currentRev = 0;
    try {
      const revStr = await redisState.get(`room:${roomId}:revision`);
      if (revStr) {
        currentRev = parseInt(revStr, 10) || 0;
      }
    } catch {
      currentRev = 0;
    }

    // Query Postgres for room details and existing members
    let dbRoom;
    try {
      dbRoom = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          members: {
            where: { status: 'JOINED' },
            include: { user: true },
          },
          playbackState: {
            include: { mediaSession: true },
          },
        },
      });
    } catch {
      dbRoom = null;
    }

    const actualHostId = dbRoom?.hostUserId || clientCtx.userId;
    const actualRoomName = dbRoom?.name || 'Watch Room';
    const actualRoomStatus = dbRoom?.status === 'CLOSED' ? 'CLOSED' : 'ACTIVE';

    // Populate members from Postgres joined members
    const memberSnapshots = (dbRoom?.members || []).map((m) => ({
      memberId: m.id,
      userId: m.userId,
      displayName: m.user?.displayName || 'Anonymous',
      role: (m.role as 'HOST' | 'PARTICIPANT') || 'PARTICIPANT',
      presence: 'ONLINE' as const,
    }));

    // Ensure the connecting member is in the members list
    if (!memberSnapshots.some((m) => m.memberId === clientCtx.memberId)) {
      memberSnapshots.push({
        memberId: clientCtx.memberId,
        userId: clientCtx.userId,
        displayName: clientCtx.displayName,
        role: clientCtx.role,
        presence: 'ONLINE' as const,
      });
    }

    // Read Playback state from Redis hot path, falling back to PostgreSQL, then default
    let playbackState: PlaybackStateStore | null;
    try {
      const stateJson = await redisState.get(`room:${roomId}:state`);
      if (stateJson) {
        playbackState = JSON.parse(stateJson);
      } else {
        playbackState = null;
      }
    } catch {
      playbackState = null;
    }

    if (!playbackState && dbRoom?.playbackState) {
      const ps = dbRoom.playbackState;
      playbackState = {
        mediaId: ps.mediaSessionId || ps.mediaSession?.id || 'default-media',
        mediaUrl: ps.mediaSession?.mediaUrl || 'https://huddly.app/media/placeholder.mp4',
        position: ps.position,
        playing: ps.isPlaying,
        playbackRate: ps.playbackRate,
        revision: Number(ps.revision),
        serverTimestamp: new Date(ps.serverTimestamp).getTime(),
      };
    }

    if (!playbackState) {
      playbackState = {
        mediaId: 'default-media',
        mediaUrl: 'https://huddly.app/media/placeholder.mp4',
        position: 0.0,
        playing: false,
        playbackRate: 1.0,
        revision: currentRev,
        serverTimestamp: Date.now(),
      };
    }

    // Compute late-joiner playback position
    let computedPosition = playbackState.position;
    if (playbackState.playing) {
      const now = Date.now();
      const elapsedSeconds = Math.max(0, (now - playbackState.serverTimestamp) / 1000);
      computedPosition = playbackState.position + elapsedSeconds * playbackState.playbackRate;
    }

    const snapshotPlayback: PlaybackSnapshot = {
      mediaId: playbackState.mediaId,
      mediaUrl: playbackState.mediaUrl,
      position: computedPosition,
      playing: playbackState.playing,
      playbackRate: playbackState.playbackRate,
      revision: playbackState.revision,
      serverTimestamp: Date.now(),
    };

    const snapshotPayload: RoomStateSnapshotPayload = {
      room: {
        roomId,
        name: actualRoomName,
        status: actualRoomStatus,
        hostId: actualHostId,
        revision: currentRev,
      },
      members: memberSnapshots,
      playback: snapshotPlayback,
      chat: {
        messages: [],
      },
    };

    const snapshotEnvelope: EventEnvelope<RoomStateSnapshotPayload> = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: randomUUID(),
      eventType: 'ROOM_STATE_SNAPSHOT',
      roomId,
      actorId: null,
      revision: currentRev,
      serverTimestamp: Date.now(),
      payload: snapshotPayload,
    };
    socket.send(JSON.stringify(snapshotEnvelope));

    // Emit PRESENCE_UPDATED (ONLINE) to room
    const joinRev = await redisState.incr(`room:${roomId}:revision`);
    const joinPresenceEnvelope: EventEnvelope<PresenceUpdatedPayload> = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: randomUUID(),
      eventType: 'PRESENCE_UPDATED',
      roomId,
      actorId: clientCtx.userId,
      revision: joinRev,
      serverTimestamp: Date.now(),
      payload: {
        memberId: clientCtx.memberId,
        status: 'ONLINE',
        updatedAt: Date.now(),
      },
    };
    await redisPubSub.publish(`room:${roomId}`, JSON.stringify(joinPresenceEnvelope));

    // Handle Incoming WebSocket Messages
    socket.on('message', async (data: Buffer | string) => {
      const receiveTime = Date.now();

      // Per-socket fixed window rate limiting (max 25 messages/second)
      const meta = state.socketMetadata.get(socket);
      if (meta) {
        if (receiveTime > meta.rateLimit.resetAt) {
          meta.rateLimit = { count: 1, resetAt: receiveTime + 1000 };
        } else {
          meta.rateLimit.count += 1;
          if (meta.rateLimit.count > MAX_EVENTS_PER_SECOND) {
            socket.send(
              JSON.stringify({
                error: 'RATE_LIMITED',
                message: 'Rate limit exceeded: maximum 25 events per second.',
              }),
            );
            return;
          }
        }
      }

      let rawMsg: Record<string, unknown>;
      try {
        rawMsg = JSON.parse(data.toString());
      } catch {
        socket.send(
          JSON.stringify({
            error: 'INVALID_JSON',
            message: 'Malformed JSON message payload',
          }),
        );
        return;
      }

      // Handle NTP-Lite Clock Sync Probe
      if (rawMsg['type'] === 'CLOCK_SYNC_PROBE') {
        const reply = {
          type: 'CLOCK_SYNC_RESPONSE',
          t1: rawMsg['t1'],
          t2: receiveTime,
          t3: Date.now(),
        };
        socket.send(JSON.stringify(reply));
        return;
      }

      // Validate Protocol v1 Envelope & Payload
      const validation = validateEventWithPayload(rawMsg);
      if (!validation.ok) {
        socket.send(
          JSON.stringify({
            error: 'PROTOCOL_VALIDATION_FAILED',
            errors: validation.errors,
          }),
        );
        return;
      }

      const env = validation.value;

      // Role check for playback mutations: Only HOST can mutate playback by default
      if (env.eventType.startsWith('PLAYBACK_') && clientCtx.role !== 'HOST') {
        socket.send(
          JSON.stringify({
            error: 'FORBIDDEN',
            message: 'Only the room host can control video playback',
          }),
        );
        return;
      }

      // Assign monotonic distributed revision via Redis atomic increment
      const nextRev = await redisState.incr(`room:${roomId}:revision`);

      // Persist playback state to Redis hot path BEFORE publishing
      if (env.eventType.startsWith('PLAYBACK_') || env.eventType.startsWith('MEDIA_')) {
        let currentPlayback: PlaybackStateStore | null = null;
        try {
          const currentStr = await redisState.get(`room:${roomId}:state`);
          if (currentStr) currentPlayback = JSON.parse(currentStr);
        } catch {
          currentPlayback = null;
        }

        const payloadObj = env.payload as Record<string, unknown>;
        const mediaId =
          (payloadObj['mediaId'] as string) || currentPlayback?.mediaId || 'default-media';
        const mediaUrl =
          (payloadObj['mediaUrl'] as string) ||
          currentPlayback?.mediaUrl ||
          'https://huddly.app/media/placeholder.mp4';

        let position = (payloadObj['position'] as number) ?? currentPlayback?.position ?? 0.0;
        let playing = currentPlayback?.playing ?? false;
        let playbackRate =
          (payloadObj['playbackRate'] as number) ?? currentPlayback?.playbackRate ?? 1.0;

        if (env.eventType === 'PLAYBACK_PLAY') {
          playing = true;
          position = (payloadObj['position'] as number) ?? position;
          playbackRate = (payloadObj['playbackRate'] as number) ?? playbackRate;
        } else if (env.eventType === 'PLAYBACK_PAUSE') {
          playing = false;
          position = (payloadObj['position'] as number) ?? position;
        } else if (env.eventType === 'PLAYBACK_SEEK') {
          position = (payloadObj['position'] as number) ?? position;
        } else if (env.eventType === 'PLAYBACK_RATE') {
          playbackRate = (payloadObj['playbackRate'] as number) ?? playbackRate;
        } else if (env.eventType === 'MEDIA_LOADED') {
          position = 0.0;
          playing = false;
        } else if (env.eventType === 'MEDIA_ENDED') {
          playing = false;
          position = (payloadObj['position'] as number) ?? position;
        }

        const updatedState: PlaybackStateStore = {
          mediaId,
          mediaUrl,
          position,
          playing,
          playbackRate,
          revision: nextRev,
          serverTimestamp: Date.now(),
        };

        await redisState.set(`room:${roomId}:state`, JSON.stringify(updatedState));

        // Asynchronously update PostgreSQL durable playback record
        prisma.playbackState
          .upsert({
            where: { roomId },
            update: {
              position,
              isPlaying: playing,
              playbackRate,
              revision: BigInt(nextRev),
              controllerUserId: clientCtx.userId,
              serverTimestamp: new Date(),
            },
            create: {
              roomId,
              position,
              isPlaying: playing,
              playbackRate,
              revision: BigInt(nextRev),
              controllerUserId: clientCtx.userId,
              serverTimestamp: new Date(),
            },
          })
          .catch(() => {});
      }

      const serverEnvelope = {
        ...env,
        eventId: randomUUID(),
        actorId: clientCtx.userId,
        revision: nextRev,
        serverTimestamp: Date.now(),
      };

      // Publish to Redis Pub/Sub for cross-node fanout
      await redisPubSub.publish(`room:${roomId}`, JSON.stringify(serverEnvelope));
    });

    // Cleanup on disconnect
    socket.on('close', async () => {
      state.socketMetadata.delete(socket);
      const roomSet = state.roomSockets.get(roomId);
      if (roomSet) {
        roomSet.delete(socket);
        if (roomSet.size === 0) {
          state.roomSockets.delete(roomId);
          await redisSub.unsubscribe(`room:${roomId}`);
        }
      }

      // Emit PRESENCE_UPDATED (OFFLINE) to room
      try {
        const leaveRev = await redisState.incr(`room:${roomId}:revision`);
        const leavePresenceEnvelope: EventEnvelope<PresenceUpdatedPayload> = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: randomUUID(),
          eventType: 'PRESENCE_UPDATED',
          roomId,
          actorId: clientCtx.userId,
          revision: leaveRev,
          serverTimestamp: Date.now(),
          payload: {
            memberId: clientCtx.memberId,
            status: 'OFFLINE',
            updatedAt: Date.now(),
          },
        };
        await redisPubSub.publish(`room:${roomId}`, JSON.stringify(leavePresenceEnvelope));
      } catch {
        // Ignore disconnect presence error if server closing
      }
    });
  });

  // WebSocket Heartbeat monitor (every 30s)
  const heartbeatInterval = setInterval(() => {
    for (const [socket, meta] of state.socketMetadata.entries()) {
      if (socket.readyState !== 1 /* OPEN */) {
        continue;
      }
      if (meta.missedPongs >= MAX_MISSED_PONGS) {
        socket.terminate();
        state.socketMetadata.delete(socket);
        continue;
      }
      meta.missedPongs += 1;
      socket.ping();
    }
  }, opts?.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS);

  app.addHook('onClose', async () => {
    clearInterval(heartbeatInterval);
    await redisSub.quit();
    if (!opts?.redisPubSub) await redisPubSub.quit();
    if (!opts?.redisState) await redisState.quit();
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const start = async () => {
    const server = await buildGatewayApp();
    try {
      await server.listen({ port: config.WS_PORT, host: config.HOST });
      server.log.info(
        `[Huddly Realtime Gateway] Server listening on ws://${config.HOST}:${config.WS_PORT}`,
      );
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  };
  void start();
}
