import type { OAuthProvider } from './types.js';
import { GoogleOAuthProvider } from './providers/google.js';
import { GitHubOAuthProvider } from './providers/github.js';
import { config } from '@huddly/config';

export class OAuthRegistry {
  private readonly providers = new Map<string, OAuthProvider>();

  register(provider: OAuthProvider): this {
    this.providers.set(provider.name.toLowerCase(), provider);
    return this;
  }

  get(name: string): OAuthProvider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  has(name: string): boolean {
    return this.providers.has(name.toLowerCase());
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}

export function createDefaultOAuthRegistry(): OAuthRegistry {
  const registry = new OAuthRegistry();

  registry.register(
    new GoogleOAuthProvider({
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      redirectBaseUrl: config.OAUTH_REDIRECT_BASE_URL,
    }),
  );

  registry.register(
    new GitHubOAuthProvider({
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
      redirectBaseUrl: config.OAUTH_REDIRECT_BASE_URL,
    }),
  );

  return registry;
}

export const defaultOAuthRegistry = createDefaultOAuthRegistry();
