import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

/**
 * Global singleton pattern for PrismaClient
 */
declare global {
  var __huddly_prisma: PrismaClient | undefined;
}

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const isDev = typeof process !== 'undefined' && process.env['NODE_ENV'] === 'development';
  if (databaseUrl) {
    return new PrismaClient({
      datasources: { db: { url: databaseUrl } },
      log: isDev ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return new PrismaClient({
    log: isDev ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalThis.__huddly_prisma || createPrismaClient();

if (typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production') {
  globalThis.__huddly_prisma = prisma;
}
