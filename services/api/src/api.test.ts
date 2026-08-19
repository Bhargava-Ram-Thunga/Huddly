import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './server.js';

interface MockUser {
  id: string;
  email: string | null;
  passwordHash: string | null;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
  status: string;
  createdAt: Date;
}

interface MockUserDevice {
  id: string;
  userId: string;
  deviceType: string;
  userAgent: string | null;
  refreshTokenHash: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

interface MockRoomSettings {
  maxParticipants: number;
  isLocked: boolean;
  allowGuestChat: boolean;
  allowGuestVoice: boolean;
  autoCloseOnHostLeave?: boolean;
}

interface MockRoom {
  id: string;
  roomCode: string;
  name: string;
  hostUserId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  settings: MockRoomSettings;
  playbackState: {
    status: string;
    position: number;
    playbackRate: number;
    revision: bigint;
  };
}

// Mock Redis
vi.mock('ioredis', () => {
  const store = new Map<string, string>();
  class MockRedis {
    async setex(key: string, _ttl: number, val: string) {
      store.set(key, val);
      return 'OK';
    }
    async quit() {
      return 'OK';
    }
    on() {}
  }
  return {
    Redis: MockRedis,
    default: MockRedis,
  };
});

// Mock database calls for fast isolated unit tests
vi.mock('@huddly/database', () => {
  const users: MockUser[] = [];
  const devices: MockUserDevice[] = [];
  const rooms: MockRoom[] = [];

  return {
    prisma: {
      user: {
        create: vi.fn().mockImplementation(
          async ({
            data,
          }: {
            data: {
              email?: string | null;
              passwordHash?: string | null;
              displayName: string;
              avatarUrl?: string | null;
              isGuest?: boolean;
              status?: string;
              devices?: {
                create?: {
                  deviceType?: string;
                  userAgent?: string | null;
                  refreshTokenHash?: string | null;
                };
              };
            };
          }) => {
            const user: MockUser = {
              id: `user-${users.length + 1}-${Date.now()}`,
              email: data.email ?? null,
              passwordHash: data.passwordHash ?? null,
              displayName: data.displayName,
              avatarUrl: data.avatarUrl ?? null,
              isGuest: data.isGuest ?? false,
              status: data.status ?? 'ACTIVE',
              createdAt: new Date(),
            };
            users.push(user);

            if (data.devices?.create) {
              devices.push({
                id: `device-${devices.length + 1}`,
                userId: user.id,
                deviceType: data.devices.create.deviceType ?? 'WEB',
                userAgent: data.devices.create.userAgent ?? null,
                refreshTokenHash: data.devices.create.refreshTokenHash ?? null,
                lastSeenAt: new Date(),
                createdAt: new Date(),
              });
            }

            return user;
          },
        ),
        findUnique: vi
          .fn()
          .mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
            if (where.id) {
              return users.find((u) => u.id === where.id) || null;
            }
            if (where.email) {
              return users.find((u) => u.email === where.email) || null;
            }
            return null;
          }),
      },
      userDevice: {
        create: vi.fn().mockImplementation(
          async ({
            data,
          }: {
            data: {
              userId: string;
              deviceType?: string;
              userAgent?: string | null;
              refreshTokenHash?: string | null;
            };
          }) => {
            const device: MockUserDevice = {
              id: `device-${devices.length + 1}`,
              userId: data.userId,
              deviceType: data.deviceType ?? 'WEB',
              userAgent: data.userAgent ?? null,
              refreshTokenHash: data.refreshTokenHash ?? null,
              lastSeenAt: new Date(),
              createdAt: new Date(),
            };
            devices.push(device);
            return device;
          },
        ),
        findFirst: vi
          .fn()
          .mockImplementation(
            async ({
              where,
            }: {
              where: { refreshTokenHash?: string };
              include?: { user?: boolean };
            }) => {
              const device = devices.find((d) => d.refreshTokenHash === where.refreshTokenHash);
              if (!device) return null;
              const user = users.find((u) => u.id === device.userId);
              return {
                ...device,
                user: user || null,
              };
            },
          ),
        update: vi
          .fn()
          .mockImplementation(
            async ({
              where,
              data,
            }: {
              where: { id: string };
              data: { refreshTokenHash?: string | null; lastSeenAt?: Date };
            }) => {
              const device = devices.find((d) => d.id === where.id);
              if (!device) throw new Error('Device not found');
              if (data.refreshTokenHash !== undefined)
                device.refreshTokenHash = data.refreshTokenHash;
              if (data.lastSeenAt !== undefined) device.lastSeenAt = data.lastSeenAt;
              return device;
            },
          ),
        updateMany: vi
          .fn()
          .mockImplementation(
            async ({
              where,
              data,
            }: {
              where: { refreshTokenHash?: string; userId?: string };
              data: { refreshTokenHash?: string | null };
            }) => {
              let count = 0;
              for (const d of devices) {
                if (
                  (where.refreshTokenHash && d.refreshTokenHash === where.refreshTokenHash) ||
                  (where.userId && d.userId === where.userId)
                ) {
                  if (data.refreshTokenHash !== undefined)
                    d.refreshTokenHash = data.refreshTokenHash;
                  count++;
                }
              }
              return { count };
            },
          ),
      },
      room: {
        create: vi.fn().mockImplementation(
          async ({
            data,
          }: {
            data: {
              roomCode: string;
              name: string;
              hostUser: { connect: { id: string } };
              status?: string;
              settings?: { create?: Partial<MockRoomSettings> };
            };
          }) => {
            const room: MockRoom = {
              id: `room-${rooms.length + 1}-${Date.now()}`,
              roomCode: data.roomCode,
              name: data.name,
              hostUserId: data.hostUser.connect.id,
              status: data.status ?? 'ACTIVE',
              createdAt: new Date(),
              updatedAt: new Date(),
              settings: {
                maxParticipants: data.settings?.create?.maxParticipants ?? 10,
                isLocked: data.settings?.create?.isLocked ?? false,
                allowGuestChat: data.settings?.create?.allowGuestChat ?? true,
                allowGuestVoice: data.settings?.create?.allowGuestVoice ?? true,
                autoCloseOnHostLeave: data.settings?.create?.autoCloseOnHostLeave ?? false,
              },
              playbackState: {
                status: 'PAUSED',
                position: 0.0,
                playbackRate: 1.0,
                revision: 0n,
              },
            };
            rooms.push(room);
            return room;
          },
        ),
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          const found = rooms.find((r) => r.id === where.id);
          if (!found) return null;
          return {
            ...found,
            members: [{ userId: found.hostUserId, status: 'JOINED' }],
          };
        }),
        findFirst: vi
          .fn()
          .mockImplementation(async ({ where }: { where: { id?: string; roomCode?: string } }) => {
            const code = where.roomCode || where.id;
            const found = rooms.find((r) => r.roomCode === code || r.id === code);
            if (!found) return null;
            return {
              ...found,
              hostUser: { id: found.hostUserId, displayName: 'Host_User' },
              members: [],
            };
          }),
        update: vi.fn().mockImplementation(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: {
              name?: string;
              status?: string;
              settings?: { update?: Partial<MockRoomSettings> };
            };
          }) => {
            const index = rooms.findIndex((r) => r.id === where.id);
            if (index === -1) throw new Error('Room not found');
            const current = rooms[index]!;
            const updated: MockRoom = {
              ...current,
              name: data.name ?? current.name,
              status: data.status ?? current.status,
              updatedAt: new Date(),
              settings: {
                ...current.settings,
                ...(data.settings?.update || {}),
              },
            };
            rooms[index] = updated;
            return {
              ...updated,
              members: [{ userId: updated.hostUserId, status: 'JOINED' }],
            };
          },
        ),
      },
      roomMember: {
        findUnique: vi.fn().mockImplementation(async () => ({
          id: 'member-123',
          role: 'HOST',
          status: 'JOINED',
        })),
        upsert: vi
          .fn()
          .mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
            id: 'member-123',
            ...create,
            joinedAt: new Date(),
          })),
      },
    },
  };
});

describe('REST API Service (@huddly/api)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Healthcheck', () => {
    it('GET /health returns 200 ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
    });
  });

  describe('Guest Authentication (AUTH-005)', () => {
    it('POST /api/v1/auth/guest generates guest user and JWT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/guest',
        payload: { displayName: 'Bhargav' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.user.displayName).toBe('Bhargav');
      expect(body.user.isGuest).toBe(true);
      expect(typeof body.token).toBe('string');
    });
  });

  describe('Email/Password Registration (AUTH-002)', () => {
    it('POST /api/v1/auth/register successfully registers a new user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'alice@example.com',
          password: 'Password123!',
          displayName: 'Alice',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.user.email).toBe('alice@example.com');
      expect(body.user.displayName).toBe('Alice');
      expect(body.user.isGuest).toBe(false);
      expect(body.user.passwordHash).toBeUndefined();
      expect(typeof body.token).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('POST /api/v1/auth/register rejects duplicate email with 409 Conflict', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'ALICE@EXAMPLE.COM',
          password: 'AnotherPassword123!',
          displayName: 'Alice Duplicate',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_EMAIL_EXISTS');
      expect(body.status).toBe(409);
    });

    it('POST /api/v1/auth/register rejects invalid email format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'Password123!',
          displayName: 'Bad Email',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_PAYLOAD');
    });

    it('POST /api/v1/auth/register rejects short passwords (<8 chars)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'short@example.com',
          password: 'short',
          displayName: 'Short Pass',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_PAYLOAD');
    });
  });

  describe('Email/Password Login (AUTH-002)', () => {
    it('POST /api/v1/auth/login succeeds with correct credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'alice@example.com',
          password: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.email).toBe('alice@example.com');
      expect(body.user.displayName).toBe('Alice');
      expect(body.user.passwordHash).toBeUndefined();
      expect(typeof body.token).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('POST /api/v1/auth/login rejects incorrect password with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'alice@example.com',
          password: 'WrongPassword999!',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_CREDENTIALS');
    });

    it('POST /api/v1/auth/login rejects non-existent email with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_CREDENTIALS');
    });
  });

  describe('Session & Refresh Token Management (AUTH-003 & AUTH-007)', () => {
    let activeRefreshToken: string;
    let rotatedRefreshToken: string;

    beforeAll(async () => {
      const registerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'refresh_tester@example.com',
          password: 'Password123!',
          displayName: 'Refresh Tester',
        },
      });
      activeRefreshToken = JSON.parse(registerRes.body).refreshToken;
    });

    it('POST /api/v1/auth/refresh rotates token and returns new access token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: activeRefreshToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(typeof body.token).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
      expect(body.refreshToken).not.toBe(activeRefreshToken);
      rotatedRefreshToken = body.refreshToken;
    });

    it('POST /api/v1/auth/refresh rejects reuse of already rotated refresh token (401)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: activeRefreshToken }, // Old rotated token
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_TOKEN');
    });

    it('POST /api/v1/auth/refresh rejects missing refreshToken payload (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_PAYLOAD');
    });

    it('POST /api/v1/auth/logout invalidates device session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: { refreshToken: rotatedRefreshToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.message).toBe('Logged out successfully');
    });

    it('POST /api/v1/auth/refresh fails after logout revocation (401)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: rotatedRefreshToken },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_TOKEN');
    });
  });

  describe('Authenticated Profile (GET /me)', () => {
    it('GET /api/v1/auth/me returns profile for registered user', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'alice@example.com',
          password: 'Password123!',
        },
      });
      const { token } = JSON.parse(loginRes.body);

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(meRes.statusCode).toBe(200);
      const body = JSON.parse(meRes.body);
      expect(body.email).toBe('alice@example.com');
      expect(body.displayName).toBe('Alice');
      expect(body.isGuest).toBe(false);
      expect(body.passwordHash).toBeUndefined();
    });

    it('GET /api/v1/auth/me rejects unauthenticated request with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_UNAUTHORIZED');
    });
  });

  describe('Rooms CRUD & Permissions (ROOM-001)', () => {
    let hostToken: string;
    let otherToken: string;
    let createdRoomId: string;

    beforeAll(async () => {
      const hostAuth = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/guest',
        payload: { displayName: 'Host_User' },
      });
      hostToken = JSON.parse(hostAuth.body).token;

      const otherAuth = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/guest',
        payload: { displayName: 'Other_User' },
      });
      otherToken = JSON.parse(otherAuth.body).token;
    });

    it('POST /api/v1/rooms requires authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        payload: { name: 'Dune Night' },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_UNAUTHORIZED');
    });

    it('POST /api/v1/rooms creates room with authenticated token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Dune Night', mediaUrl: 'https://youtube.com/watch?v=123' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('Dune Night');
      expect(body.roomCode).toMatch(/^hud-[a-z0-9]{4}$/);
      expect(body.playbackState.status).toBe('PAUSED');
      createdRoomId = body.id;
    });

    it('PATCH /api/v1/rooms/:id allows host to update settings', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/rooms/${createdRoomId}`,
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Dune Part 2', isLocked: true, maxParticipants: 20 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('Dune Part 2');
      expect(body.settings.isLocked).toBe(true);
      expect(body.settings.maxParticipants).toBe(20);
    });

    it('PATCH /api/v1/rooms/:id forbids non-hosts from modifying settings', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/rooms/${createdRoomId}`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Hacked Room' },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_FORBIDDEN');
    });

    it('PATCH /api/v1/rooms/:id returns 404 for non-existent room', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/rooms/non-existent-room-id',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'New Name' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_ROOM_NOT_FOUND');
    });

    it('POST /api/v1/rooms/:id/join rejects joining locked room', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/rooms/${createdRoomId}/join`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_ROOM_LOCKED');
    });

    it('DELETE /api/v1/rooms/:id forbids non-hosts from closing room', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/rooms/${createdRoomId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_FORBIDDEN');
    });

    it('DELETE /api/v1/rooms/:id allows host to close room', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/rooms/${createdRoomId}`,
        headers: { authorization: `Bearer ${hostToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('CLOSED');
      expect(body.message).toBe('Room closed successfully');
    });
  });

  describe('Realtime Tickets (REALTIME-002)', () => {
    it('POST /api/v1/realtime/ticket rejects unauthenticated request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_UNAUTHORIZED');
    });

    it('POST /api/v1/realtime/ticket issues 60-second connection ticket for authenticated user', async () => {
      const authRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/guest',
        payload: { displayName: 'Ticket_User' },
      });
      const { token } = JSON.parse(authRes.body);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${token}` },
        payload: { roomId: '11111111-1111-4111-8111-111111111111' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(typeof body.ticket).toBe('string');
      expect(body.expiresIn).toBe(60);
    });
  });
});
