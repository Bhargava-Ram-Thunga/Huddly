import type {
  OAuthProvider,
  OAuthAuthorizationUrlOptions,
  OAuthExchangeCodeOptions,
  OAuthUserProfile,
} from '../types.js';

export interface GitHubOAuthProviderConfig {
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  redirectBaseUrl?: string | undefined;
}

export class GitHubOAuthProvider implements OAuthProvider {
  readonly name = 'github';
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectBaseUrl: string;

  constructor(config: GitHubOAuthProviderConfig = {}) {
    this.clientId = config.clientId || '';
    this.clientSecret = config.clientSecret || '';
    this.redirectBaseUrl = config.redirectBaseUrl || 'http://localhost:5173';
  }

  getAuthorizationUrl(options: OAuthAuthorizationUrlOptions): string {
    const redirectUri = options.redirectUri || `${this.redirectBaseUrl}/auth/callback/github`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state: options.state,
    });

    if (options.codeChallenge) {
      params.set('code_challenge', options.codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(options: OAuthExchangeCodeOptions): Promise<OAuthUserProfile> {
    const redirectUri = options.redirectUri || `${this.redirectBaseUrl}/auth/callback/github`;
    const bodyParams = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: options.code,
      redirect_uri: redirectUri,
    });

    if (options.codeVerifier) {
      bodyParams.set('code_verifier', options.codeVerifier);
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: bodyParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`GitHub token exchange failed (${tokenResponse.status}): ${errorText}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(
        `GitHub token exchange error: ${tokenData.error_description || tokenData.error || 'missing access_token'}`,
      );
    }

    const accessToken = tokenData.access_token;

    // Fetch user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Huddly-Auth-Service',
        Accept: 'application/vnd.github+json',
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      throw new Error(`GitHub user request failed (${userResponse.status}): ${errorText}`);
    }

    const userData = (await userResponse.json()) as {
      id: number;
      login: string;
      name?: string | null;
      email?: string | null;
      avatar_url?: string | null;
    };

    let resolvedEmail = userData.email;
    let isEmailVerified = false;

    // If email is private or null, fetch from user/emails endpoint
    if (!resolvedEmail) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Huddly-Auth-Service',
          Accept: 'application/vnd.github+json',
        },
      });

      if (emailsResponse.ok) {
        const emailsData = (await emailsResponse.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;

        const primaryEmail =
          emailsData.find((e) => e.primary && e.verified) ||
          emailsData.find((e) => e.verified) ||
          emailsData[0];

        if (primaryEmail) {
          resolvedEmail = primaryEmail.email;
          isEmailVerified = primaryEmail.verified;
        }
      }
    } else {
      isEmailVerified = true;
    }

    if (!resolvedEmail) {
      throw new Error('GitHub account does not have an accessible email address');
    }

    return {
      id: String(userData.id),
      email: resolvedEmail,
      displayName: userData.name || userData.login || 'GitHub User',
      avatarUrl: userData.avatar_url || null,
      emailVerified: isEmailVerified,
    };
  }
}
