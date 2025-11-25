import { Router, Request, Response } from 'express';
import { oauthService, DealService, scoringEngine } from '../services';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
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
    const pipelines = await dealService.getAllPipelines();

    res.json({
      success: true,
      pipelines,
    });
  } catch (error) {
    console.error('List pipelines error:', error);
    res.status(500).json({
      error: 'Failed to list pipelines',
      message: 'An error occurred while fetching pipelines',
    });
  }
});

router.get('/:pipelineId/metrics', async (req: Request, res: Response) => {
  const { pipelineId } = req.params;
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

    const pipeline = await dealService.getPipeline(pipelineId);
    const { deals } = await dealService.getDeals(100);

    const pipelineDeals = deals.filter((d) => d.properties.pipeline === pipelineId);

    const stageHistories = new Map<string, Array<{ stageId: string; timestamp: Date }>>();
    for (const deal of pipelineDeals) {
      const history = await dealService.getDealStageHistory(deal.id);
      stageHistories.set(deal.id, history);
    }

    const metrics = scoringEngine.calculatePipelineMetrics(pipelineDeals, pipeline, stageHistories);

    const stageMetricsArray = Array.from(metrics.stageMetrics.entries()).map(([stageId, data]) => {
      const stage = pipeline.stages.find((s) => s.id === stageId);
      return {
        ...data,
        stageName: stage?.label || stageId,
      };
    });

    res.json({
      success: true,
      metrics: {
        pipelineId: metrics.pipelineId,
        pipelineName: pipeline.label,
        stageMetrics: stageMetricsArray,
        averageStagesToClose: metrics.averageStagesToClose,
        winRate: metrics.winRate,
        dealsAnalyzed: pipelineDeals.length,
      },
    });
  } catch (error) {
    console.error('Pipeline metrics error:', error);
    res.status(500).json({
      error: 'Failed to calculate metrics',
      message: 'An error occurred while calculating pipeline metrics',
    });
  }
});

export default router;
