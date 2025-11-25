import { Client } from '@hubspot/api-client';
import { config } from '../config';
import { HubSpotToken, TokenStore } from '../types';

const tokenStore: TokenStore = {};

export class OAuthService {
  private hubspotClient: Client;

  constructor() {
    this.hubspotClient = new Client();
  }

  getAuthorizationUrl(state: string): string {
    const scopes = config.hubspot.scopes.join(' ');
    const params = new URLSearchParams({
      client_id: config.hubspot.clientId,
      redirect_uri: config.hubspot.redirectUri,
      scope: scopes,
      state: state,
    });

    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<HubSpotToken> {
    const tokenResponse = await this.hubspotClient.oauth.tokensApi.create(
      'authorization_code',
      code,
      config.hubspot.redirectUri,
      config.hubspot.clientId,
      config.hubspot.clientSecret
    );

    const expiresAt = Date.now() + tokenResponse.expiresIn * 1000;

    const accessTokenInfo = await this.hubspotClient.oauth.accessTokensApi.get(
      tokenResponse.accessToken
    );

    const token: HubSpotToken = {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresAt,
      portalId: accessTokenInfo.hubId,
    };

    this.storeToken(token);
    return token;
  }

  async refreshAccessToken(portalId: number): Promise<HubSpotToken | null> {
    const existingToken = this.getToken(portalId);
    if (!existingToken) {
      return null;
    }

    try {
      const tokenResponse = await this.hubspotClient.oauth.tokensApi.create(
        'refresh_token',
        undefined,
        undefined,
        config.hubspot.clientId,
        config.hubspot.clientSecret,
        existingToken.refreshToken
      );

      const expiresAt = Date.now() + tokenResponse.expiresIn * 1000;

      const token: HubSpotToken = {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresAt,
        portalId,
      };

      this.storeToken(token);
      return token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      this.removeToken(portalId);
      return null;
    }
  }

  async getValidAccessToken(portalId: number): Promise<string | null> {
    const token = this.getToken(portalId);
    if (!token) {
      return null;
    }

    const bufferMs = 5 * 60 * 1000;
    if (token.expiresAt - bufferMs < Date.now()) {
      const refreshedToken = await this.refreshAccessToken(portalId);
      return refreshedToken?.accessToken || null;
    }

    return token.accessToken;
  }

  storeToken(token: HubSpotToken): void {
    tokenStore[token.portalId.toString()] = token;
  }

  getToken(portalId: number): HubSpotToken | null {
    return tokenStore[portalId.toString()] || null;
  }

  removeToken(portalId: number): void {
    delete tokenStore[portalId.toString()];
  }

  isAuthenticated(portalId: number): boolean {
    const token = this.getToken(portalId);
    return token !== null && token.expiresAt > Date.now();
  }

  getAuthenticatedClient(accessToken: string): Client {
    return new Client({ accessToken });
  }
}

export const oauthService = new OAuthService();
