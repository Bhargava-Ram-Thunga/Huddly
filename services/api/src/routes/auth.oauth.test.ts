import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server.js';
import { generateOAuthState } from '../oauth/state.js';
import { defaultOAuthRegistry } from '../oauth/registry.js';

interface MockUser {
  id: string;
  email: string | null;
  passwordHash: string | null;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
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

const mockUsers: MockUser[] = [];
const mockDevices: MockUserDevice[] = [];

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
              id: `user-${mockUsers.length + 1}-${Date.now()}`,
              email: data.email ?? null,
              passwordHash: data.passwordHash ?? null,
              displayName: data.displayName,
              avatarUrl: data.avatarUrl ?? null,
              isGuest: data.isGuest ?? false,
              status: data.status ?? 'ACTIVE',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockUsers.push(user);

            if (data.devices?.create) {
              mockDevices.push({
                id: `device-${mockDevices.length + 1}`,
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
              return mockUsers.find((u) => u.id === where.id) || null;
            }
            if (where.email) {
              return mockUsers.find((u) => u.email === where.email) || null;
            }
            return null;
          }),
        update: vi
          .fn()
          .mockImplementation(
            async ({
              where,
              data,
            }: {
              where: { id: string };
              data: { avatarUrl?: string | null; displayName?: string };
            }) => {
              const user = mockUsers.find((u) => u.id === where.id);
              if (!user) throw new Error('User not found');
              if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
              if (data.displayName !== undefined) user.displayName = data.displayName;
              user.updatedAt = new Date();
              return user;
            },
          ),
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
              id: `device-${mockDevices.length + 1}`,
              userId: data.userId,
              deviceType: data.deviceType ?? 'WEB',
              userAgent: data.userAgent ?? null,
              refreshTokenHash: data.refreshTokenHash ?? null,
              lastSeenAt: new Date(),
              createdAt: new Date(),
            };
            mockDevices.push(device);
            return device;
          },
        ),
      },
    },
  };
});

describe('OAuth Authentication Routes (AUTH-004)', () => {
  let app: FastifyInstance;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('GET /api/v1/auth/oauth/:provider/url', () => {
    it('returns authorization URL, state token, and PKCE parameters for Google', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/oauth/google/url',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.provider).toBe('google');
      expect(body.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(body.url).toContain('state=');
      expect(body.url).toContain('code_challenge=');
      expect(typeof body.state).toBe('string');
      expect(typeof body.codeVerifier).toBe('string');
      expect(typeof body.codeChallenge).toBe('string');
    });

    it('returns authorization URL and state token for GitHub', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/oauth/github/url',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.provider).toBe('github');
      expect(body.url).toContain('https://github.com/login/oauth/authorize');
      expect(body.url).toContain('state=');
      expect(typeof body.state).toBe('string');
    });

    it('returns 400 Bad Request for unsupported provider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/oauth/unsupported_provider/url',
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_PAYLOAD');
      expect(body.detail).toContain("OAuth provider 'unsupported_provider' is not supported");
    });
  });

  describe('POST /api/v1/auth/oauth/callback', () => {
    it('creates a new user and issues JWT tokens upon first OAuth login', async () => {
      const googleProvider = defaultOAuthRegistry.get('google');
      if (!googleProvider) throw new Error('Google provider not registered');

      vi.spyOn(googleProvider, 'exchangeCode').mockResolvedValueOnce({
        id: 'google-uid-100',
        email: 'new_google_user@example.com',
        displayName: 'New Google User',
        avatarUrl: 'https://example.com/avatar.png',
        emailVerified: true,
      });

      const validState = generateOAuthState('google');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/oauth/callback',
        payload: {
          provider: 'google',
          code: 'valid-auth-code',
          state: validState,
          codeVerifier: 'pkce-code-verifier',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.email).toBe('new_google_user@example.com');
      expect(body.user.displayName).toBe('New Google User');
      expect(body.user.avatarUrl).toBe('https://example.com/avatar.png');
      expect(body.user.isGuest).toBe(false);
      expect(body.linked).toBe(false);
      expect(typeof body.token).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('links to an existing user when OAuth verified email matches an existing account', async () => {
      // Create existing user first with email & password
      const registerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'link_target@example.com',
          password: 'Password123!',
          displayName: 'Existing User',
        },
      });
      expect(registerRes.statusCode).toBe(201);
      const existingUser = JSON.parse(registerRes.body).user;

      const githubProvider = defaultOAuthRegistry.get('github');
      if (!githubProvider) throw new Error('GitHub provider not registered');

      vi.spyOn(githubProvider, 'exchangeCode').mockResolvedValueOnce({
        id: 'github-uid-200',
        email: 'LINK_TARGET@example.com', // Test email normalization
        displayName: 'GitHub Profile Name',
        avatarUrl: 'https://github.com/avatar.png',
        emailVerified: true,
      });

      const validState = generateOAuthState('github');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/oauth/callback',
        payload: {
          provider: 'github',
          code: 'valid-github-code',
          state: validState,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Confirms account linking to same user id
      expect(body.user.id).toBe(existingUser.id);
      expect(body.user.email).toBe('link_target@example.com');
      expect(body.linked).toBe(true);
      expect(typeof body.token).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('rejects callback with mismatched or tampered state token (CSRF failure)', async () => {
      const invalidState = 'tampered.state.token';

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/oauth/callback',
        payload: {
          provider: 'google',
          code: 'some-code',
          state: invalidState,
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_TOKEN');
      expect(body.title).toContain('Invalid or Expired OAuth State');
    });

    it('rejects callback for suspended or inactive user (403)', async () => {
      const suspendedEmail = 'suspended_user@example.com';
      mockUsers.push({
        id: 'suspended-user-id',
        email: suspendedEmail,
        passwordHash: null,
        displayName: 'Suspended Account',
        avatarUrl: null,
        status: 'SUSPENDED',
        isGuest: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const googleProvider = defaultOAuthRegistry.get('google');
      if (!googleProvider) throw new Error('Google provider not registered');

      vi.spyOn(googleProvider, 'exchangeCode').mockResolvedValueOnce({
        id: 'google-uid-suspended',
        email: suspendedEmail,
        displayName: 'Suspended User',
        emailVerified: true,
      });

      const validState = generateOAuthState('google');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/oauth/callback',
        payload: {
          provider: 'google',
          code: 'any-code',
          state: validState,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_ACCOUNT_INACTIVE');
    });

    it('rejects callback with missing required parameters (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/oauth/callback',
        payload: {
          provider: 'google',
          // missing code and state
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_PAYLOAD');
    });
  });
});
