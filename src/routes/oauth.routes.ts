import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { oauthService } from '../services';

const router = Router();

router.get('/install', (_req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = oauthService.getAuthorizationUrl(state);
  res.redirect(authUrl);
});

router.get('/callback', async (req: Request, res: Response) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('OAuth error:', error, error_description);
    return res.status(400).json({
      error: 'OAuth Error',
      message: error_description || 'Authorization failed',
    });
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      error: 'Missing Code',
      message: 'Authorization code is required',
    });
  }

  try {
    const token = await oauthService.exchangeCodeForTokens(code);

    res.json({
      success: true,
      message: 'App installed successfully',
      portalId: token.portalId,
    });
  } catch (err) {
    console.error('Token exchange error:', err);
    res.status(500).json({
      error: 'Token Exchange Failed',
      message: 'Failed to complete authorization',
    });
  }
});

router.get('/status/:portalId', (req: Request, res: Response) => {
  const portalId = parseInt(req.params.portalId, 10);

  if (isNaN(portalId)) {
    return res.status(400).json({
      error: 'Invalid Portal ID',
      message: 'Portal ID must be a number',
    });
  }

  const isAuthenticated = oauthService.isAuthenticated(portalId);

  res.json({
    portalId,
    isAuthenticated,
  });
});

export default router;
