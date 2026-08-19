import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { prisma } from '@huddly/database';
import { config } from '@huddly/config';

const TicketRequestSchema = z.object({
  roomId: z.string().uuid(),
});

export const ticketRoutes: FastifyPluginAsync = async (fastify) => {
  const redisState = new Redis(config.REDIS_STATE_URL);

  fastify.addHook('onClose', async () => {
    await redisState.quit();
  });

  /**
   * POST /api/v1/realtime/ticket
   * Mint single-use, 60-second connection ticket for WebSocket upgrade
   */
  fastify.post('/ticket', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as { sub: string; displayName: string };
    const parseResult = TicketRequestSchema.safeParse(request.body || {});

    if (!parseResult.success) {
      return reply.status(400).send({
        type: 'https://huddly.app/errors/invalid-payload',
        title: 'Invalid Ticket Request',
        status: 400,
        detail: parseResult.error.issues[0]?.message || 'Invalid payload',
        code: 'ERR_INVALID_PAYLOAD',
      });
    }

    const { roomId } = parseResult.data;

    // Verify room and active membership
    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: userPayload.sub,
        },
      },
    });

    if (!membership || membership.status !== 'JOINED') {
      return reply.status(403).send({
        type: 'https://huddly.app/errors/not-a-member',
        title: 'Not a Room Member',
        status: 403,
        detail: 'User must join the room before requesting a realtime connection ticket.',
        code: 'ERR_NOT_ROOM_MEMBER',
      });
    }

    const ticket = randomUUID();
    const ticketData = {
      userId: userPayload.sub,
      displayName: userPayload.displayName,
      roomId,
      memberId: membership.id,
      role: membership.role,
      issuedAt: Date.now(),
    };

    // Store in Redis State instance with 60 seconds TTL
    await redisState.setex(`ticket:${ticket}`, 60, JSON.stringify(ticketData));

    return reply.status(200).send({
      ticket,
      expiresIn: 60,
      wsUrl: `ws://${config.HOST}:${config.WS_PORT}/ws?ticket=${ticket}`,
    });
  });
};
