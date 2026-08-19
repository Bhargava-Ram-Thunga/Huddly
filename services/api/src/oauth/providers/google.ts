import type {
  OAuthProvider,
  OAuthAuthorizationUrlOptions,
  OAuthExchangeCodeOptions,
  OAuthUserProfile,
} from '../types.js';

export interface GoogleOAuthProviderConfig {
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  redirectBaseUrl?: string | undefined;
}

export class GoogleOAuthProvider implements OAuthProvider {
  readonly name = 'google';
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectBaseUrl: string;

  constructor(config: GoogleOAuthProviderConfig = {}) {
    this.clientId = config.clientId || '';
    this.clientSecret = config.clientSecret || '';
    this.redirectBaseUrl = config.redirectBaseUrl || 'http://localhost:5173';
  }

  getAuthorizationUrl(options: OAuthAuthorizationUrlOptions): string {
    const redirectUri = options.redirectUri || `${this.redirectBaseUrl}/auth/callback/google`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: options.state,
      access_type: 'offline',
      prompt: 'select_account',
    });

    if (options.codeChallenge) {
      params.set('code_challenge', options.codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(options: OAuthExchangeCodeOptions): Promise<OAuthUserProfile> {
    const redirectUri = options.redirectUri || `${this.redirectBaseUrl}/auth/callback/google`;
    const bodyParams = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: options.code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    if (options.codeVerifier) {
      bodyParams.set('code_verifier', options.codeVerifier);
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: bodyParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Google token exchange failed (${tokenResponse.status}): ${errorText}`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string; id_token?: string };
    if (!tokenData.access_token) {
      throw new Error('Google token exchange response missing access_token');
    }

    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      throw new Error(`Google userinfo request failed (${userInfoResponse.status}): ${errorText}`);
    }

    const userData = (await userInfoResponse.json()) as {
      sub: string;
      email: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!userData.email) {
      throw new Error('Google user profile does not contain an email address');
    }

    return {
      id: userData.sub,
      email: userData.email,
      displayName: userData.name || userData.email.split('@')[0] || 'Google User',
      avatarUrl: userData.picture || null,
      emailVerified: Boolean(userData.email_verified),
    };
  }
}
