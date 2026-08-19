import { describe, it, expect } from 'vitest';
import { parseConfig } from './index.js';

describe('@huddly/config', () => {
  it('loads valid default development configuration', () => {
    const config = parseConfig({});
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.WS_PORT).toBe(3001);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.DATABASE_URL).toContain('postgresql://');
    expect(config.REDIS_PUBSUB_URL).toBe('redis://localhost:6379/0');
    expect(config.REDIS_STATE_URL).toBe('redis://localhost:6379/1');
    expect(config.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(Array.isArray(config.CORS_ORIGINS)).toBe(true);
  });

  it('correctly parses custom environment variables', () => {
    const custom = parseConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      WS_PORT: '8081',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/huddly_test',
      REDIS_PUBSUB_URL: 'redis://localhost:6379/0',
      REDIS_STATE_URL: 'redis://localhost:6379/1',
      JWT_SECRET: 'replace-me-with-openssl-rand-hex-32-character-test-key',
      CORS_ORIGINS: 'https://huddly.app, https://app.huddly.app',
      LIVEKIT_URL: 'https://livekit.huddly.app',
      LIVEKIT_API_KEY: 'test-livekit-api-key-identifier',
      LIVEKIT_API_SECRET: 'test-livekit-api-secret-key-material',
      GOOGLE_CLIENT_ID: 'test-google-client-id',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
      GITHUB_CLIENT_ID: 'test-github-client-id',
      GITHUB_CLIENT_SECRET: 'test-github-client-secret',
      OAUTH_REDIRECT_BASE_URL: 'https://huddly.app',
    });

    expect(custom.NODE_ENV).toBe('production');
    expect(custom.PORT).toBe(8080);
    expect(custom.WS_PORT).toBe(8081);
    expect(custom.DATABASE_URL).toBe('postgresql://user:password@localhost:5432/huddly_test');
    expect(custom.CORS_ORIGINS).toEqual(['https://huddly.app', 'https://app.huddly.app']);
    expect(custom.LIVEKIT_URL).toBe('https://livekit.huddly.app');
    expect(custom.GOOGLE_CLIENT_ID).toBe('test-google-client-id');
    expect(custom.GOOGLE_CLIENT_SECRET).toBe('test-google-client-secret');
    expect(custom.GITHUB_CLIENT_ID).toBe('test-github-client-id');
    expect(custom.GITHUB_CLIENT_SECRET).toBe('test-github-client-secret');
    expect(custom.OAUTH_REDIRECT_BASE_URL).toBe('https://huddly.app');
  });

  it('rejects short JWT_SECRET (< 32 chars)', () => {
    expect(() =>
      parseConfig({
        JWT_SECRET: 'too_short',
      }),
    ).toThrowError(/JWT_SECRET must be at least 32 characters/);
  });

  it('rejects invalid NODE_ENV', () => {
    expect(() =>
      parseConfig({
        NODE_ENV: 'invalid_env' as unknown as 'development',
      }),
    ).toThrowError(/Environment validation failed/);
  });

  it('rejects invalid URL for DATABASE_URL', () => {
    expect(() =>
      parseConfig({
        DATABASE_URL: 'not-a-valid-url',
      }),
    ).toThrowError(/DATABASE_URL/);
  });
});
