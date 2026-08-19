export interface OAuthUserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null | undefined;
  emailVerified: boolean;
}

export interface OAuthAuthorizationUrlOptions {
  state: string;
  codeChallenge?: string | undefined;
  redirectUri?: string | undefined;
}

export interface OAuthExchangeCodeOptions {
  code: string;
  codeVerifier?: string | undefined;
  redirectUri?: string | undefined;
}

export interface OAuthProvider {
  readonly name: string;
  getAuthorizationUrl(options: OAuthAuthorizationUrlOptions): string;
  exchangeCode(options: OAuthExchangeCodeOptions): Promise<OAuthUserProfile>;
}
