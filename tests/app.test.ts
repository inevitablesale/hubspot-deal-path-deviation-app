import request from 'supertest';
import app from '../src/app';

describe('App', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });
  });
});

describe('OAuth Routes', () => {
  describe('GET /oauth/install', () => {
    it('should redirect to HubSpot authorization', async () => {
      const response = await request(app).get('/oauth/install');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('app.hubspot.com/oauth/authorize');
    });
  });

  describe('GET /oauth/callback', () => {
    it('should return error when code is missing', async () => {
      const response = await request(app).get('/oauth/callback');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing Code');
    });

    it('should handle OAuth errors', async () => {
      const response = await request(app)
        .get('/oauth/callback')
        .query({ error: 'access_denied', error_description: 'User denied access' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('OAuth Error');
    });
  });

  describe('GET /oauth/status/:portalId', () => {
    it('should return unauthenticated for unknown portal', async () => {
      const response = await request(app).get('/oauth/status/12345');

      expect(response.status).toBe(200);
      expect(response.body.portalId).toBe(12345);
      expect(response.body.isAuthenticated).toBe(false);
    });

    it('should return error for invalid portal ID', async () => {
      const response = await request(app).get('/oauth/status/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid Portal ID');
    });
  });
});

describe('CRM Card Routes', () => {
  describe('GET /crm-card/deal-deviation', () => {
    it('should return error when parameters are missing', async () => {
      const response = await request(app).get('/crm-card/deal-deviation');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required parameters');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/crm-card/deal-deviation')
        .query({ associatedObjectId: '123', portalId: '99999' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });
  });
});

describe('Deals Routes', () => {
  describe('GET /api/deals', () => {
    it('should return error when portal ID is missing', async () => {
      const response = await request(app).get('/api/deals');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing Portal ID');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/deals')
        .query({ portalId: '99999' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('GET /api/deals/:dealId', () => {
    it('should return error when portal ID is missing', async () => {
      const response = await request(app).get('/api/deals/123');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing Portal ID');
    });
  });

  describe('GET /api/deals/:dealId/analysis', () => {
    it('should return error when portal ID is missing', async () => {
      const response = await request(app).get('/api/deals/123/analysis');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing Portal ID');
    });
  });
});

describe('Pipelines Routes', () => {
  describe('GET /api/pipelines', () => {
    it('should return error when portal ID is missing', async () => {
      const response = await request(app).get('/api/pipelines');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing Portal ID');
    });
  });

  describe('GET /api/pipelines/:pipelineId/metrics', () => {
    it('should return error when portal ID is missing', async () => {
      const response = await request(app).get('/api/pipelines/pipeline-1/metrics');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing Portal ID');
    });
  });
});
