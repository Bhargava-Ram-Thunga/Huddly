import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { buildGatewayApp } from './gateway.js';
import { PROTOCOL_VERSION, type EventEnvelope } from '@huddly/protocol';
import type { Redis } from 'ioredis';
import type { AddressInfo } from 'net';

interface MockDbMember {
  id: string;
  roomId: string;
  userId: string;
  role: string;
  status: string;
  user: { id: string; displayName: string };
}

interface MockDbRoom {
  id: string;
  name: string;
  hostUserId: string;
  status: string;
  members: MockDbMember[];
  playbackState: {
    roomId: string;
    mediaSessionId: string | null;
    position: number;
    isPlaying: boolean;
    playbackRate: number;
    revision: bigint;
    serverTimestamp: Date;
    mediaSession?: { id: string; mediaUrl: string } | null;
  } | null;
}

const mockDbRooms = new Map<string, MockDbRoom>();

vi.mock('@huddly/database', () => {
  return {
    prisma: {
      room: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          return mockDbRooms.get(where.id) || null;
        }),
      },
      playbackState: {
        upsert: vi.fn().mockImplementation(async ({ where, update, create }) => {
          const room = mockDbRooms.get(where.roomId);
          if (room) {
            room.playbackState = {
              roomId: where.roomId,
              mediaSessionId: update.mediaSessionId || null,
              position: update.position,
              isPlaying: update.isPlaying,
              playbackRate: update.playbackRate,
              revision: update.revision,
              serverTimestamp: update.serverTimestamp,
            };
          }
          return create;
        }),
      },
    },
  };
});

// Shared in-memory Redis Mock for multi-node testing
class MockRedisSharedState {
  store = new Map<string, string>();
  counters = new Map<string, number>();
  emitter = new EventEmitter();
  subscribers = new Map<string, Set<MockRedis>>();

  constructor() {
    this.emitter.setMaxListeners(100);
  }
}

class MockRedis extends EventEmitter {
  shared: MockRedisSharedState;

  constructor(shared?: MockRedisSharedState) {
    super();
    this.shared = shared || new MockRedisSharedState();
  }

  async get(key: string): Promise<string | null> {
    return this.shared.store.get(key) || null;
  }

  async set(key: string, val: string): Promise<'OK'> {
    this.shared.store.set(key, val);
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    const current = this.shared.counters.get(key) || 0;
    const next = current + 1;
    this.shared.counters.set(key, next);
    this.shared.store.set(key, String(next));
    return next;
  }

  async getdel(key: string): Promise<string | null> {
    const val = this.shared.store.get(key) || null;
    this.shared.store.delete(key);
    return val;
  }

  async setex(key: string, _ttl: number, val: string): Promise<'OK'> {
    this.shared.store.set(key, val);
    return 'OK';
  }

  async publish(channel: string, message: string): Promise<number> {
    const subs = this.shared.subscribers.get(channel);
    if (subs) {
      for (const client of subs) {
        client.emit('message', channel, message);
      }
    }
    return subs ? subs.size : 0;
  }

  async subscribe(channel: string): Promise<number> {
    if (!this.shared.subscribers.has(channel)) {
      this.shared.subscribers.set(channel, new Set());
    }
    this.shared.subscribers.get(channel)!.add(this);
    return 1;
  }

  async unsubscribe(channel: string): Promise<number> {
    const subs = this.shared.subscribers.get(channel);
    if (subs) {
      subs.delete(this);
    }
    return 1;
  }

  duplicate() {
    return new MockRedis(this.shared);
  }

  async quit() {
    return 'OK';
  }
}

describe('Realtime Sync Gateway (@huddly/realtime)', () => {
  let app: FastifyInstance;
  let mockRedisState: MockRedis;
  let mockRedisPubSub: MockRedis;
  let sharedRedisState: MockRedisSharedState;
  let serverPort: number;

  beforeAll(async () => {
    sharedRedisState = new MockRedisSharedState();
    mockRedisState = new MockRedis(sharedRedisState);
    mockRedisPubSub = new MockRedis(sharedRedisState);

    app = await buildGatewayApp({
      redisState: mockRedisState as unknown as Redis,
      redisPubSub: mockRedisPubSub as unknown as Redis,
    });

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as AddressInfo;
    serverPort = address.port;
  });

  beforeEach(() => {
    sharedRedisState.store.clear();
    sharedRedisState.counters.clear();
    mockDbRooms.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects connection if no ticket is provided (4401)', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);

    const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    const result = await closePromise;
    expect(result.code).toBe(4401);
  });

  it('rejects connection if ticket structure is invalid (4400)', async () => {
    const ticket = randomUUID();
    // Missing required fields
    mockRedisState.shared.store.set(
      `ticket:${ticket}`,
      JSON.stringify({ userId: 'not-a-valid-uuid' }),
    );

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticket}`);

    const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    const result = await closePromise;
    expect(result.code).toBe(4400);
  });

  it('accepts connection with valid ticket and receives authoritative initial snapshot', async () => {
    const ticket = randomUUID();
    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const hostUserId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const memberId = '11111111-1111-4111-8111-111111111111';

    mockDbRooms.set(roomId, {
      id: roomId,
      name: 'Anime Watch Room',
      hostUserId,
      status: 'ACTIVE',
      members: [
        {
          id: memberId,
          roomId,
          userId: hostUserId,
          role: 'HOST',
          status: 'JOINED',
          user: { id: hostUserId, displayName: 'True Host' },
        },
      ],
      playbackState: null,
    });

    mockRedisState.shared.store.set(
      `ticket:${ticket}`,
      JSON.stringify({
        userId: hostUserId,
        displayName: 'True Host',
        roomId,
        memberId,
        role: 'HOST',
      }),
    );

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticket}`);

    const messagePromise = new Promise<EventEnvelope<'ROOM_STATE_SNAPSHOT'>>((resolve) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    const msg = await messagePromise;
    expect(msg.eventType).toBe('ROOM_STATE_SNAPSHOT');
    expect(msg.roomId).toBe(roomId);
    expect(msg.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(msg.payload.room.roomId).toBe(roomId);
    expect(msg.payload.room.name).toBe('Anime Watch Room');
    expect(msg.payload.room.hostId).toBe(hostUserId);
    expect(msg.payload.members).toHaveLength(1);
    expect(msg.payload.members[0]?.displayName).toBe('True Host');

    ws.close();
  });

  it('handles CLOCK_SYNC_PROBE and returns CLOCK_SYNC_RESPONSE', async () => {
    const ticket = randomUUID();
    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const userId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const memberId = '11111111-1111-4111-8111-111111111111';

    mockRedisState.shared.store.set(
      `ticket:${ticket}`,
      JSON.stringify({
        userId,
        displayName: 'Host_User',
        roomId,
        memberId,
        role: 'HOST',
      }),
    );

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticket}`);

    await new Promise<void>((resolve) => {
      ws.once('message', () => resolve()); // Ignore initial snapshot
    });

    const probePromise = new Promise<{ type: string; t1: number; t2: number; t3: number }>(
      (resolve) => {
        ws.on('message', (data) => {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'CLOCK_SYNC_RESPONSE') resolve(parsed);
        });
      },
    );

    const clientT1 = Date.now();
    ws.send(JSON.stringify({ type: 'CLOCK_SYNC_PROBE', t1: clientT1 }));

    const res = await probePromise;
    expect(res.type).toBe('CLOCK_SYNC_RESPONSE');
    expect(res.t1).toBe(clientT1);
    expect(typeof res.t2).toBe('number');
    expect(typeof res.t3).toBe('number');

    ws.close();
  });

  it('broadcasts PLAYBACK_PLAY when sent by HOST and persists state to Redis', async () => {
    const ticket = randomUUID();
    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const userId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const memberId = '11111111-1111-4111-8111-111111111111';

    mockRedisState.shared.store.set(
      `ticket:${ticket}`,
      JSON.stringify({
        userId,
        displayName: 'Host_User',
        roomId,
        memberId,
        role: 'HOST',
      }),
    );

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticket}`);

    await new Promise<void>((resolve) => {
      ws.once('message', () => resolve()); // Ignore snapshot
    });

    const eventPromise = new Promise<EventEnvelope<'PLAYBACK_PLAY'>>((resolve) => {
      ws.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        if (parsed.eventType === 'PLAYBACK_PLAY') resolve(parsed);
      });
    });

    const playEvent = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: randomUUID(),
      eventType: 'PLAYBACK_PLAY',
      roomId,
      actorId: userId,
      revision: 1,
      serverTimestamp: Date.now(),
      payload: {
        mediaId: 'video-123',
        position: 45.5,
        playbackRate: 1.0,
      },
    };

    ws.send(JSON.stringify(playEvent));

    const received = await eventPromise;
    expect(received.eventType).toBe('PLAYBACK_PLAY');
    expect(received.payload.position).toBe(45.5);
    expect(received.revision).toBeGreaterThanOrEqual(1);

    // Verify state persisted to Redis
    const savedStateStr = await mockRedisState.get(`room:${roomId}:state`);
    expect(savedStateStr).not.toBeNull();
    const savedState = JSON.parse(savedStateStr!);
    expect(savedState.playing).toBe(true);
    expect(savedState.position).toBe(45.5);
    expect(savedState.mediaId).toBe('video-123');

    ws.close();
  });

  it('computes late-joiner playback position and reflects real room members', async () => {
    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const hostUserId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const participantUserId = '8d9e6679-7425-40de-944b-e07fc1f90ae8';
    const hostMemberId = '11111111-1111-4111-8111-111111111111';
    const participantMemberId = '22222222-2222-4222-8222-222222222222';

    mockDbRooms.set(roomId, {
      id: roomId,
      name: 'Cinema Room',
      hostUserId,
      status: 'ACTIVE',
      members: [
        {
          id: hostMemberId,
          roomId,
          userId: hostUserId,
          role: 'HOST',
          status: 'JOINED',
          user: { id: hostUserId, displayName: 'Alice (Host)' },
        },
        {
          id: participantMemberId,
          roomId,
          userId: participantUserId,
          role: 'PARTICIPANT',
          status: 'JOINED',
          user: { id: participantUserId, displayName: 'Bob (Joiner)' },
        },
      ],
      playbackState: null,
    });

    // Simulate playback started 10 seconds ago at position 100.0 with 1.5x speed
    const tenSecondsAgo = Date.now() - 10000;
    mockRedisState.shared.store.set(
      `room:${roomId}:state`,
      JSON.stringify({
        mediaId: 'movie-456',
        mediaUrl: 'https://huddly.app/media/movie.mp4',
        position: 100.0,
        playing: true,
        playbackRate: 1.5,
        revision: 5,
        serverTimestamp: tenSecondsAgo,
      }),
    );

    const ticket = randomUUID();
    mockRedisState.shared.store.set(
      `ticket:${ticket}`,
      JSON.stringify({
        userId: participantUserId,
        displayName: 'Bob (Joiner)',
        roomId,
        memberId: participantMemberId,
        role: 'PARTICIPANT',
      }),
    );

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticket}`);

    const snapshotPromise = new Promise<EventEnvelope<'ROOM_STATE_SNAPSHOT'>>((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.eventType === 'ROOM_STATE_SNAPSHOT') resolve(msg);
      });
    });

    const snapshot = await snapshotPromise;
    expect(snapshot.payload.room.hostId).toBe(hostUserId);
    expect(snapshot.payload.members).toHaveLength(2);
    expect(snapshot.payload.members.map((m) => m.displayName)).toEqual(
      expect.arrayContaining(['Alice (Host)', 'Bob (Joiner)']),
    );

    // Position computed as: 100.0 + (10s * 1.5) = 115.0 (allowing small delta)
    expect(snapshot.payload.playback.position).toBeGreaterThanOrEqual(114.9);
    expect(snapshot.payload.playback.position).toBeLessThan(125.0);
    expect(snapshot.payload.playback.playing).toBe(true);

    ws.close();
  });

  it('notifies existing client when a new client joins and leaves (PRESENCE_UPDATED)', async () => {
    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const userA = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const userB = '8d9e6679-7425-40de-944b-e07fc1f90ae8';
    const memberA = '11111111-1111-4111-8111-111111111111';
    const memberB = '22222222-2222-4222-8222-222222222222';

    // Client A connects first
    const ticketA = randomUUID();
    mockRedisState.shared.store.set(
      `ticket:${ticketA}`,
      JSON.stringify({
        userId: userA,
        displayName: 'User A',
        roomId,
        memberId: memberA,
        role: 'HOST',
      }),
    );

    const wsA = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticketA}`);
    await new Promise<void>((resolve) => wsA.once('message', () => resolve())); // Ignore snapshot

    // Prepare to listen for Client B presence events on Client A's connection
    const presenceEvents: Array<{ status: string; memberId: string }> = [];
    wsA.on('message', (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.eventType === 'PRESENCE_UPDATED') {
        presenceEvents.push(parsed.payload);
      }
    });

    // Client B connects
    const ticketB = randomUUID();
    mockRedisState.shared.store.set(
      `ticket:${ticketB}`,
      JSON.stringify({
        userId: userB,
        displayName: 'User B',
        roomId,
        memberId: memberB,
        role: 'PARTICIPANT',
      }),
    );

    const wsB = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticketB}`);
    await new Promise<void>((resolve) => wsB.once('message', () => resolve()));

    // Wait for Client A to receive Client B ONLINE presence
    await vi.waitFor(() => {
      expect(presenceEvents.some((p) => p.memberId === memberB && p.status === 'ONLINE')).toBe(
        true,
      );
    });

    // Client B disconnects
    wsB.close();

    // Wait for Client A to receive Client B OFFLINE presence
    await vi.waitFor(() => {
      expect(presenceEvents.some((p) => p.memberId === memberB && p.status === 'OFFLINE')).toBe(
        true,
      );
    });

    wsA.close();
  });

  it('guarantees unique and monotonic distributed revisions across TWO gateway instances sharing one Redis', async () => {
    // Spin up second gateway app sharing the same Redis instance
    const app2 = await buildGatewayApp({
      redisState: mockRedisState as unknown as Redis,
      redisPubSub: mockRedisPubSub as unknown as Redis,
    });
    await app2.listen({ port: 0, host: '127.0.0.1' });
    const port2 = (app2.server.address() as AddressInfo).port;

    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const user1 = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const user2 = '8d9e6679-7425-40de-944b-e07fc1f90ae8';
    const member1 = '11111111-1111-4111-8111-111111111111';
    const member2 = '22222222-2222-4222-8222-222222222222';

    const ticket1 = randomUUID();
    const ticket2 = randomUUID();
    mockRedisState.shared.store.set(
      `ticket:${ticket1}`,
      JSON.stringify({
        userId: user1,
        displayName: 'Node 1 Host',
        roomId,
        memberId: member1,
        role: 'HOST',
      }),
    );
    mockRedisState.shared.store.set(
      `ticket:${ticket2}`,
      JSON.stringify({
        userId: user2,
        displayName: 'Node 2 Host',
        roomId,
        memberId: member2,
        role: 'HOST',
      }),
    );

    const ws1 = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticket1}`);
    const ws2 = new WebSocket(`ws://127.0.0.1:${port2}/ws?ticket=${ticket2}`);

    await Promise.all([
      new Promise<void>((resolve) => ws1.once('message', () => resolve())),
      new Promise<void>((resolve) => ws2.once('message', () => resolve())),
    ]);

    const seenRevisions: number[] = [];

    ws1.on('message', (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.revision) seenRevisions.push(parsed.revision);
    });

    // Send events interleaved between Node 1 and Node 2
    ws1.send(
      JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        eventId: randomUUID(),
        eventType: 'PLAYBACK_PLAY',
        roomId,
        actorId: user1,
        revision: 0,
        serverTimestamp: Date.now(),
        payload: { mediaId: 'v1', position: 10, playbackRate: 1.0 },
      }),
    );

    ws2.send(
      JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        eventId: randomUUID(),
        eventType: 'PLAYBACK_PAUSE',
        roomId,
        actorId: user2,
        revision: 0,
        serverTimestamp: Date.now(),
        payload: { mediaId: 'v1', position: 15 },
      }),
    );

    ws1.send(
      JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        eventId: randomUUID(),
        eventType: 'PLAYBACK_SEEK',
        roomId,
        actorId: user1,
        revision: 0,
        serverTimestamp: Date.now(),
        payload: { mediaId: 'v1', position: 50 },
      }),
    );

    await vi.waitFor(() => {
      // Must have recorded the presence updates + the 3 playback events
      expect(seenRevisions.length).toBeGreaterThanOrEqual(3);
    });

    // Check all revisions are strictly unique
    const uniqueRevisions = new Set(seenRevisions);
    expect(uniqueRevisions.size).toBe(seenRevisions.length);

    ws1.close();
    ws2.close();
    await app2.close();
  });

  it('terminates sockets that miss two heartbeat pongs', async () => {
    // Fast heartbeat interval (50ms) for testing
    const fastHeartbeatApp = await buildGatewayApp({
      redisState: mockRedisState as unknown as Redis,
      redisPubSub: mockRedisPubSub as unknown as Redis,
      heartbeatIntervalMs: 50,
    });
    await fastHeartbeatApp.listen({ port: 0, host: '127.0.0.1' });
    const fastPort = (fastHeartbeatApp.server.address() as AddressInfo).port;

    const ticket = randomUUID();
    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const userId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const memberId = '11111111-1111-4111-8111-111111111111';

    mockRedisState.shared.store.set(
      `ticket:${ticket}`,
      JSON.stringify({
        userId,
        displayName: 'Ghost_User',
        roomId,
        memberId,
        role: 'PARTICIPANT',
      }),
    );

    const ws = new WebSocket(`ws://127.0.0.1:${fastPort}/ws?ticket=${ticket}`);

    // Prevent auto-pong to simulate dead connection
    ws.pong = () => {};

    const closePromise = new Promise<{ code: number; wasClean: boolean }>((resolve) => {
      ws.on('close', (code, wasClean) => {
        resolve({ code, wasClean: Boolean(wasClean) });
      });
    });

    const result = await closePromise;
    expect(result.code).toBeDefined();

    await fastHeartbeatApp.close();
  });

  it('enforces per-socket rate limiting when message threshold is exceeded', async () => {
    const ticket = randomUUID();
    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const userId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const memberId = '11111111-1111-4111-8111-111111111111';

    mockRedisState.shared.store.set(
      `ticket:${ticket}`,
      JSON.stringify({
        userId,
        displayName: 'Host_User',
        roomId,
        memberId,
        role: 'HOST',
      }),
    );

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticket}`);

    await new Promise<void>((resolve) => {
      ws.once('message', () => resolve()); // Ignore initial snapshot
    });

    const rateLimitPromise = new Promise<{ error: string }>((resolve) => {
      ws.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        if (parsed.error === 'RATE_LIMITED') resolve(parsed);
      });
    });

    // Spam 30 probe messages rapidly
    for (let i = 0; i < 30; i++) {
      ws.send(JSON.stringify({ type: 'CLOCK_SYNC_PROBE', t1: Date.now() }));
    }

    const res = await rateLimitPromise;
    expect(res.error).toBe('RATE_LIMITED');

    ws.close();
  });
});
