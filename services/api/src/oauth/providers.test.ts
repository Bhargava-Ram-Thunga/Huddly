import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleOAuthProvider } from './providers/google.js';
import { GitHubOAuthProvider } from './providers/github.js';
import { OAuthRegistry } from './registry.js';
import type { OAuthProvider } from './types.js';

describe('OAuth Providers & Registry', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('GoogleOAuthProvider', () => {
    const google = new GoogleOAuthProvider({
      clientId: 'mock-google-client-id',
      clientSecret: 'mock-google-client-secret',
      redirectBaseUrl: 'https://huddly.app',
    });

    it('builds a valid Google authorization URL with PKCE and state', () => {
      const urlString = google.getAuthorizationUrl({
        state: 'test-state-123',
        codeChallenge: 'test-challenge-abc',
      });

      const url = new URL(urlString);
      expect(url.origin).toBe('https://accounts.google.com');
      expect(url.pathname).toBe('/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe('mock-google-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('https://huddly.app/auth/callback/google');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(url.searchParams.get('state')).toBe('test-state-123');
      expect(url.searchParams.get('code_challenge')).toBe('test-challenge-abc');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('exchanges code for user profile successfully', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('oauth2.googleapis.com/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'mock-google-access-token' }),
          } as Response;
        }
        if (urlStr.includes('openidconnect.googleapis.com/v1/userinfo')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              sub: 'google-user-12345',
              email: 'google.user@example.com',
              email_verified: true,
              name: 'Google User',
              picture: 'https://lh3.googleusercontent.com/avatar.jpg',
            }),
          } as Response;
        }
        return { ok: false, status: 404, text: async () => 'Not Found' } as Response;
      });

      const profile = await google.exchangeCode({
        code: 'auth-code-123',
        codeVerifier: 'pkce-verifier-123',
      });

      expect(profile.id).toBe('google-user-12345');
      expect(profile.email).toBe('google.user@example.com');
      expect(profile.displayName).toBe('Google User');
      expect(profile.avatarUrl).toBe('https://lh3.googleusercontent.com/avatar.jpg');
      expect(profile.emailVerified).toBe(true);
    });

    it('throws error when Google token exchange returns non-200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      } as Response);

      await expect(google.exchangeCode({ code: 'bad-code' })).rejects.toThrowError(
        /Google token exchange failed/,
      );
    });
  });

  describe('GitHubOAuthProvider', () => {
    const github = new GitHubOAuthProvider({
      clientId: 'mock-github-client-id',
      clientSecret: 'mock-github-client-secret',
      redirectBaseUrl: 'https://huddly.app',
    });

    it('builds a valid GitHub authorization URL with state', () => {
      const urlString = github.getAuthorizationUrl({
        state: 'test-state-456',
        codeChallenge: 'test-challenge-xyz',
      });

      const url = new URL(urlString);
      expect(url.origin).toBe('https://github.com');
      expect(url.pathname).toBe('/login/oauth/authorize');
      expect(url.searchParams.get('client_id')).toBe('mock-github-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('https://huddly.app/auth/callback/github');
      expect(url.searchParams.get('scope')).toBe('read:user user:email');
      expect(url.searchParams.get('state')).toBe('test-state-456');
    });

    it('exchanges code and resolves primary verified email when email is private', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('github.com/login/oauth/access_token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'mock-github-token' }),
          } as Response;
        }
        if (urlStr === 'https://api.github.com/user') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 987654,
              login: 'octocat',
              name: 'Mona Lisa Octocat',
              email: null, // private email on main profile
              avatar_url: 'https://avatars.githubusercontent.com/u/987654',
            }),
          } as Response;
        }
        if (urlStr === 'https://api.github.com/user/emails') {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { email: 'secondary@example.com', primary: false, verified: true },
              { email: 'octocat@github.com', primary: true, verified: true },
            ],
          } as Response;
        }
        return { ok: false, status: 404, text: async () => 'Not Found' } as Response;
      });

      const profile = await github.exchangeCode({ code: 'valid-code' });

      expect(profile.id).toBe('987654');
      expect(profile.email).toBe('octocat@github.com');
      expect(profile.displayName).toBe('Mona Lisa Octocat');
      expect(profile.avatarUrl).toBe('https://avatars.githubusercontent.com/u/987654');
      expect(profile.emailVerified).toBe(true);
    });
  });

  describe('OAuthRegistry (Extensibility)', () => {
    it('allows registering and resolving custom OAuth providers dynamically without touching core logic', () => {
      const registry = new OAuthRegistry();

      const customProvider: OAuthProvider = {
        name: 'discord',
        getAuthorizationUrl: () => 'https://discord.com/api/oauth2/authorize',
        exchangeCode: async () => ({
          id: 'discord-123',
          email: 'user@discord.gg',
          displayName: 'DiscordUser',
          emailVerified: true,
        }),
      };

      registry.register(customProvider);

      expect(registry.has('discord')).toBe(true);
      expect(registry.has('DISCORD')).toBe(true);
      expect(registry.get('discord')?.name).toBe('discord');
      expect(registry.list()).toEqual(['discord']);
    });
  });
});
