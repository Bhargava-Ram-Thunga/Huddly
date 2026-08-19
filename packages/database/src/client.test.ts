import { describe, it, expect } from 'vitest';
import { createPrismaClient, prisma } from './index.js';

describe('@huddly/database Client & Schema Verification (AUTH-001)', () => {
  it('instantiates PrismaClient factory function', () => {
    const client = createPrismaClient('postgresql://user:pass@localhost:5432/testdb');
    expect(client).toBeDefined();
    expect(typeof client.$connect).toBe('function');
    expect(typeof client.$disconnect).toBe('function');
  });

  it('exposes user and user_device model delegate interfaces', () => {
    expect(prisma.user).toBeDefined();
    expect(typeof prisma.user.create).toBe('function');
    expect(typeof prisma.user.findUnique).toBe('function');
    expect(typeof prisma.user.findFirst).toBe('function');
    expect(typeof prisma.user.update).toBe('function');

    expect(prisma.userDevice).toBeDefined();
    expect(typeof prisma.userDevice.create).toBe('function');
    expect(typeof prisma.userDevice.findMany).toBe('function');
  });

  it('exposes room and playback state model delegate interfaces', () => {
    expect(prisma.room).toBeDefined();
    expect(typeof prisma.room.create).toBe('function');
    expect(prisma.roomMember).toBeDefined();
    expect(prisma.roomPermission).toBeDefined();
    expect(prisma.playbackState).toBeDefined();
    expect(prisma.playbackEvent).toBeDefined();
    expect(prisma.navigationState).toBeDefined();
    expect(prisma.moderationAction).toBeDefined();
  });
});
