import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  hubspot: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
  };
  session: {
    secret: string;
  };
  app: {
    baseUrl: string;
  };
}

function getEnvVar(name: string, defaultValue = ''): string {
  return process.env[name] || defaultValue;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  hubspot: {
    clientId: getEnvVar('HUBSPOT_CLIENT_ID'),
    clientSecret: getEnvVar('HUBSPOT_CLIENT_SECRET'),
    redirectUri: getEnvVar('HUBSPOT_REDIRECT_URI', 'http://localhost:3000/oauth/callback'),
    scopes: (process.env.HUBSPOT_SCOPES || 'crm.objects.deals.read crm.objects.deals.write crm.schemas.deals.read timeline').split(' '),
  },
  session: {
    secret: getEnvVar('SESSION_SECRET', 'default-dev-secret'),
  },
  app: {
    baseUrl: getEnvVar('APP_BASE_URL', 'http://localhost:3000'),
  },
};

export function isConfigValid(): boolean {
  return !!(config.hubspot.clientId && config.hubspot.clientSecret);
}
