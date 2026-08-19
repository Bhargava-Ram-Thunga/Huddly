import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, cleanupTestServer, generateToken } from '../test-utils.js';

interface MockMembership {
  id: string;
  roomId: string;
  userId: string;
  role: string;
  status: string;
}

const mockMembers = new Map<string, MockMembership>();
const redisStore = new Map<string, { value: string; ttl: number }>();

vi.mock('ioredis', () => {
  class MockRedis {
    async setex(key: string, ttl: number, val: string) {
      redisStore.set(key, { value: val, ttl });
      return 'OK';
    }
    async quit() {
      return 'OK';
    }
    on() {}
  }
  return { Redis: MockRedis, default: MockRedis };
});

vi.mock('@huddly/database', () => {
  return {
    prisma: {
      roomMember: {
        findUnique: vi
          .fn()
          .mockImplementation(
            async ({
              where,
            }: {
              where: { roomId_userId?: { roomId: string; userId: string } };
            }) => {
              if (!where.roomId_userId) return null;
              const key = `${where.roomId_userId.roomId}:${where.roomId_userId.userId}`;
              return mockMembers.get(key) || null;
            },
          ),
      },
    },
  };
});

describe('Realtime Ticket Endpoints (REALTIME-002 Comprehensive)', () => {
  let fastify: FastifyInstance;
  let memberToken: string;
  let nonMemberToken: string;
  const memberUserId = 'user-member-1';
  const nonMemberUserId = 'user-outsider-2';
  const testRoomId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeAll(async () => {
    fastify = await createTestServer();
    memberToken = generateToken(fastify, memberUserId, 'member@test.com', 'Member Tester');
    nonMemberToken = generateToken(
      fastify,
      nonMemberUserId,
      'outsider@test.com',
      'Outsider Tester',
    );
  });

  beforeEach(() => {
    mockMembers.clear();
    redisStore.clear();

    mockMembers.set(`${testRoomId}:${memberUserId}`, {
      id: 'member-ticket-123',
      roomId: testRoomId,
      userId: memberUserId,
      role: 'PARTICIPANT',
      status: 'JOINED',
    });
  });

  afterAll(async () => {
    await cleanupTestServer(fastify);
  });

  describe('POST /api/v1/realtime/ticket', () => {
    it('mints 60-second single-use connection ticket for active room member', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { roomId: testRoomId },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('ticket');
      expect(body.ticket).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(body.expiresIn).toBe(60);
      expect(body.wsUrl).toContain(`/ws?ticket=${body.ticket}`);

      // Verify Redis TTL storage
      const stored = redisStore.get(`ticket:${body.ticket}`);
      expect(stored).toBeDefined();
      expect(stored?.ttl).toBe(60);
      const data = JSON.parse(stored!.value);
      expect(data.userId).toBe(memberUserId);
      expect(data.roomId).toBe(testRoomId);
    });

    it('rejects unauthenticated ticket requests with 401 Unauthorized', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        payload: { roomId: testRoomId },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe('ERR_UNAUTHORIZED');
    });

    it('rejects ticket request when user is not a room member with 403 Forbidden', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${nonMemberToken}` },
        payload: { roomId: testRoomId },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('ERR_NOT_ROOM_MEMBER');
    });

    it('rejects ticket request when membership status is not JOINED (e.g. LEFT)', async () => {
      mockMembers.set(`${testRoomId}:${memberUserId}`, {
        id: 'member-left-123',
        roomId: testRoomId,
        userId: memberUserId,
        role: 'PARTICIPANT',
        status: 'LEFT',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { roomId: testRoomId },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('ERR_NOT_ROOM_MEMBER');
    });

    it('rejects ticket request missing roomId payload with 400 Bad Request', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('ERR_INVALID_PAYLOAD');
    });

    it('rejects ticket request with invalid non-UUID roomId with 400 Bad Request', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { roomId: 'not-a-valid-uuid' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('ERR_INVALID_PAYLOAD');
    });

    it('generates distinct tickets across sequential requests', async () => {
      const res1 = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { roomId: testRoomId },
      });

      const res2 = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { roomId: testRoomId },
      });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(res1.json().ticket).not.toBe(res2.json().ticket);
    });
  });
});
