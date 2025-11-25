import { Router, Request, Response } from 'express';
import { oauthService, DealService, scoringEngine, TimelineService } from '../services';

const router = Router();

router.get('/:dealId', async (req: Request, res: Response) => {
  const { dealId } = req.params;
  const { portalId } = req.query;

  if (!portalId || typeof portalId !== 'string') {
    return res.status(400).json({
      error: 'Missing Portal ID',
      message: 'portalId query parameter is required',
    });
  }

  const portalIdNum = parseInt(portalId, 10);

  try {
    const accessToken = await oauthService.getValidAccessToken(portalIdNum);

    if (!accessToken) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'Please install the app first',
      });
    }

    const dealService = new DealService(accessToken);
    const deal = await dealService.getDeal(dealId);

    res.json({
      success: true,
      deal,
    });
  } catch (error) {
    console.error('Get deal error:', error);
    res.status(500).json({
      error: 'Failed to get deal',
      message: 'An error occurred while fetching the deal',
    });
  }
});

router.get('/:dealId/analysis', async (req: Request, res: Response) => {
  const { dealId } = req.params;
  const { portalId } = req.query;

  if (!portalId || typeof portalId !== 'string') {
    return res.status(400).json({
      error: 'Missing Portal ID',
      message: 'portalId query parameter is required',
    });
  }

  const portalIdNum = parseInt(portalId, 10);

  try {
    const accessToken = await oauthService.getValidAccessToken(portalIdNum);

    if (!accessToken) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'Please install the app first',
      });
    }

    const dealService = new DealService(accessToken);

    const deal = await dealService.getDeal(dealId);
    const pipeline = await dealService.getPipeline(deal.properties.pipeline);
    const stageHistory = await dealService.getDealStageHistory(dealId);

    const dealScore = scoringEngine.analyzeDeal(deal, pipeline, stageHistory);

    res.json({
      success: true,
      analysis: dealScore,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: 'An error occurred while analyzing the deal',
    });
  }
});

router.post('/:dealId/refresh-analysis', async (req: Request, res: Response) => {
  const { dealId } = req.params;
  const { portalId } = req.query;

  if (!portalId || typeof portalId !== 'string') {
    return res.status(400).json({
      error: 'Missing Portal ID',
      message: 'portalId query parameter is required',
    });
  }

  const portalIdNum = parseInt(portalId, 10);

  try {
    const accessToken = await oauthService.getValidAccessToken(portalIdNum);

    if (!accessToken) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'Please install the app first',
      });
    }

    const dealService = new DealService(accessToken);
    const timelineService = new TimelineService(accessToken);

    const deal = await dealService.getDeal(dealId);
    const pipeline = await dealService.getPipeline(deal.properties.pipeline);
    const stageHistory = await dealService.getDealStageHistory(dealId);

    const dealScore = scoringEngine.analyzeDeal(deal, pipeline, stageHistory);

    const properties: Record<string, string> = {
      deal_risk_level: dealScore.overallRiskLevel,
      deal_risk_score: dealScore.riskScore.toString(),
      deal_deviation_count: dealScore.deviations.length.toString(),
      deal_last_analyzed: new Date().toISOString(),
    };

    await dealService.updateDealProperties(dealId, properties);

    await timelineService.createTimelineEvent(dealId, dealScore);

    res.json({
      success: true,
      message: 'Analysis refreshed and deal updated',
      analysis: dealScore,
    });
  } catch (error) {
    console.error('Refresh analysis error:', error);
    res.status(500).json({
      error: 'Refresh failed',
      message: 'An error occurred while refreshing the analysis',
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  const { portalId, limit = '10', after } = req.query;

  if (!portalId || typeof portalId !== 'string') {
    return res.status(400).json({
      error: 'Missing Portal ID',
      message: 'portalId query parameter is required',
    });
  }

  const portalIdNum = parseInt(portalId, 10);

  try {
    const accessToken = await oauthService.getValidAccessToken(portalIdNum);

    if (!accessToken) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'Please install the app first',
      });
    }

    const dealService = new DealService(accessToken);
    const { deals, paging } = await dealService.getDeals(
      parseInt(limit as string, 10),
      after as string | undefined
    );

    res.json({
      success: true,
      deals,
      paging,
    });
  } catch (error) {
    console.error('List deals error:', error);
    res.status(500).json({
      error: 'Failed to list deals',
      message: 'An error occurred while fetching deals',
    });
  }
});

export default router;
