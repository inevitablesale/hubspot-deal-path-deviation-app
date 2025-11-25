export interface HubSpotToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  portalId: number;
}

export interface TokenStore {
  [portalId: string]: HubSpotToken;
}

export interface OAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}
