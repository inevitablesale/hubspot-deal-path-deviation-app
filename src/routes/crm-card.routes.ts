import { Router, Request, Response } from 'express';
import { oauthService, DealService, scoringEngine } from '../services';
import { CrmCardRequest, CrmCardResponse, CrmCardResult, RiskLevel } from '../types';

const router = Router();

function getRiskStatusConfig(riskLevel: RiskLevel): {
  type: 'DEFAULT' | 'SUCCESS' | 'WARNING' | 'DANGER';
  label: string;
} {
  switch (riskLevel) {
    case 'CRITICAL':
      return { type: 'DANGER', label: 'Critical Risk' };
    case 'HIGH':
      return { type: 'DANGER', label: 'High Risk' };
    case 'MEDIUM':
      return { type: 'WARNING', label: 'Medium Risk' };
    case 'LOW':
    default:
      return { type: 'SUCCESS', label: 'Low Risk' };
  }
}

router.get('/deal-deviation', async (req: Request, res: Response) => {
  const { associatedObjectId, portalId } = req.query as unknown as CrmCardRequest;

  if (!associatedObjectId || !portalId) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'associatedObjectId and portalId are required',
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

    const deal = await dealService.getDeal(associatedObjectId);
    const pipeline = await dealService.getPipeline(deal.properties.pipeline);
    const stageHistory = await dealService.getDealStageHistory(associatedObjectId);

    const dealScore = scoringEngine.analyzeDeal(deal, pipeline, stageHistory);

    const results: CrmCardResult[] = [];

    const mainResult: CrmCardResult = {
      objectId: parseInt(associatedObjectId, 10),
      title: 'Deal Path Analysis',
      properties: [
        {
          label: 'Risk Level',
          dataType: 'STATUS',
          value: dealScore.overallRiskLevel,
          optionsMap: {
            LOW: { type: 'SUCCESS', label: 'Low Risk' },
            MEDIUM: { type: 'WARNING', label: 'Medium Risk' },
            HIGH: { type: 'DANGER', label: 'High Risk' },
            CRITICAL: { type: 'DANGER', label: 'Critical Risk' },
          },
        },
        {
          label: 'Risk Score',
          dataType: 'NUMERIC',
          value: dealScore.riskScore,
        },
        {
          label: 'Deviations Found',
          dataType: 'NUMERIC',
          value: dealScore.deviations.length,
        },
        {
          label: 'Current Stage',
          dataType: 'STRING',
          value: pipeline.stages.find((s) => s.id === deal.properties.dealstage)?.label || 'Unknown',
        },
      ],
    };

    results.push(mainResult);

    for (const deviation of dealScore.deviations) {
      const deviationResult: CrmCardResult = {
        objectId: parseInt(associatedObjectId, 10),
        title: formatDeviationType(deviation.type),
        properties: [
          {
            label: 'Risk Level',
            dataType: 'STATUS',
            value: deviation.riskLevel,
            optionsMap: {
              [deviation.riskLevel]: getRiskStatusConfig(deviation.riskLevel),
            },
          },
          {
            label: 'Description',
            dataType: 'STRING',
            value: deviation.description,
          },
          {
            label: 'Recommendation',
            dataType: 'STRING',
            value: deviation.recommendation,
          },
        ],
      };

      results.push(deviationResult);
    }

    const response: CrmCardResponse = {
      results,
      primaryAction: {
        type: 'ACTION_HOOK',
        httpMethod: 'POST',
        url: `${req.protocol}://${req.get('host')}/api/deals/${associatedObjectId}/refresh-analysis`,
        label: 'Refresh Analysis',
      },
    };

    res.json(response);
  } catch (error) {
    console.error('CRM card error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: 'Failed to analyze deal deviations',
    });
  }
});

function formatDeviationType(type: string): string {
  const typeLabels: Record<string, string> = {
    STALLED_DEAL: '⏸️ Stalled Deal',
    SKIPPED_STAGE: '⏭️ Skipped Stage',
    ABNORMAL_TIME_IN_STAGE: '⏰ Abnormal Time in Stage',
    BACKWARD_MOVEMENT: '↩️ Backward Movement',
  };
  return typeLabels[type] || type;
}

export default router;
