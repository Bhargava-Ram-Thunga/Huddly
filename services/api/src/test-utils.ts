import { buildApp } from './server.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@huddly/database';

/**
 * Create and initialize a test Fastify server instance
 * Connects to test database and loads all plugins
 */
export async function createTestServer(): Promise<FastifyInstance> {
  const fastify = await buildApp();
  await fastify.ready();
  return fastify;
}

/**
 * Cleanup: close server and clear all test data
 * Run this in afterAll() hook in tests
 */
export async function cleanupTestServer(fastify: FastifyInstance): Promise<void> {
  await fastify.close();

  try {
    // Only attempt Prisma database deletes if database is connected in test environment
    if (process.env.TEST_DB_CLEANUP === 'true') {
      await Promise.all([
        prisma.auditEvent.deleteMany(),
        prisma.messageReaction.deleteMany(),
        prisma.chatMessage.deleteMany(),
        prisma.moderationAction.deleteMany(),
        prisma.playbackEvent.deleteMany(),
        prisma.navigationState.deleteMany(),
        prisma.playbackState.deleteMany(),
        prisma.mediaSession.deleteMany(),
        prisma.roomMember.deleteMany(),
        prisma.roomInvite.deleteMany(),
        prisma.roomPermission.deleteMany(),
        prisma.roomSettings.deleteMany(),
        prisma.room.deleteMany(),
        prisma.userDevice.deleteMany(),
        prisma.user.deleteMany(),
      ]);
    }
  } catch (error) {
    console.error('Test cleanup notice:', error);
  }
}

/**
 * Helper: Create a test user with auth token
 */
export async function createTestUser(email = 'test@example.com', displayName = 'Test User') {
  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashforunittesting',
      isGuest: false,
      status: 'ACTIVE',
    },
  });

  return user;
}

/**
 * Helper: Create a test room
 */
export async function createTestRoom(hostUserId: string, name = 'Test Room') {
  const room = await prisma.room.create({
    data: {
      roomCode: `test-${Date.now().toString().slice(-4)}`,
      name,
      hostUserId,
      status: 'ACTIVE',
      settings: {
        create: {
          maxParticipants: 10,
          isLocked: false,
          allowGuestChat: true,
          allowGuestVoice: true,
          defaultMemberRole: 'PARTICIPANT',
        },
      },
      playbackState: {
        create: {
          status: 'PAUSED',
          position: 0,
          playbackRate: 1.0,
          revision: 0n,
        },
      },
    },
    include: {
      settings: true,
      playbackState: true,
    },
  });

  return room;
}

/**
 * Helper: Generate JWT token for user
 */
export function generateToken(
  fastify: FastifyInstance,
  userId: string,
  email: string,
  displayName: string,
  expiresIn = '1h',
): string {
  return fastify.jwt.sign(
    {
      sub: userId,
      email,
      displayName,
      isGuest: false,
    },
    { expiresIn },
  );
}

/**
 * Helper: Generate guest token
 */
export function generateGuestToken(
  fastify: FastifyInstance,
  userId: string,
  displayName: string,
  expiresIn = '1h',
): string {
  return fastify.jwt.sign(
    {
      sub: userId,
      displayName,
      isGuest: true,
    },
    { expiresIn },
  );
}

export const build = buildApp;
export { buildApp };
