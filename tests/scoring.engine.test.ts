import { ScoringEngine } from '../src/services/scoring.engine';
import { Deal, Pipeline, DEFAULT_SCORING_CONFIG } from '../src/types';

describe('ScoringEngine', () => {
  let scoringEngine: ScoringEngine;
  let mockPipeline: Pipeline;
  let mockDeal: Deal;

  beforeEach(() => {
    scoringEngine = new ScoringEngine(DEFAULT_SCORING_CONFIG);

    mockPipeline = {
      id: 'pipeline-1',
      label: 'Sales Pipeline',
      stages: [
        { id: 'stage-1', label: 'Qualification', displayOrder: 0, metadata: {} },
        { id: 'stage-2', label: 'Discovery', displayOrder: 1, metadata: {} },
        { id: 'stage-3', label: 'Proposal', displayOrder: 2, metadata: {} },
        { id: 'stage-4', label: 'Negotiation', displayOrder: 3, metadata: {} },
        { id: 'stage-5', label: 'Closed Won', displayOrder: 4, metadata: { isClosed: 'true' } },
      ],
    };

    mockDeal = {
      id: 'deal-1',
      properties: {
        dealname: 'Test Deal',
        dealstage: 'stage-2',
        pipeline: 'pipeline-1',
        createdate: new Date().toISOString(),
        hs_lastmodifieddate: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
    };
  });

  describe('analyzeDeal', () => {
    it('should return no deviations for a healthy deal', () => {
      const stageHistory = [
        { stageId: 'stage-1', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-2', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      ];

      const result = scoringEngine.analyzeDeal(mockDeal, mockPipeline, stageHistory);

      expect(result.dealId).toBe('deal-1');
      expect(result.deviations.length).toBe(0);
      expect(result.overallRiskLevel).toBe('LOW');
      expect(result.riskScore).toBe(0);
    });

    it('should detect stalled deal when time exceeds threshold', () => {
      const stalledDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      mockDeal.properties.hs_lastmodifieddate = stalledDate.toISOString();

      const stageHistory = [
        { stageId: 'stage-1', timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-2', timestamp: stalledDate },
      ];

      const result = scoringEngine.analyzeDeal(mockDeal, mockPipeline, stageHistory);

      expect(result.deviations.length).toBeGreaterThan(0);
      const stalledDeviation = result.deviations.find((d) => d.type === 'STALLED_DEAL');
      expect(stalledDeviation).toBeDefined();
      expect(stalledDeviation?.details.daysInStage).toBeGreaterThanOrEqual(20);
    });

    it('should detect skipped stages', () => {
      mockDeal.properties.dealstage = 'stage-4';

      const stageHistory = [
        { stageId: 'stage-1', timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-4', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      ];

      const result = scoringEngine.analyzeDeal(mockDeal, mockPipeline, stageHistory);

      const skippedDeviation = result.deviations.find((d) => d.type === 'SKIPPED_STAGE');
      expect(skippedDeviation).toBeDefined();
      expect(skippedDeviation?.details.skippedStages).toContain('Discovery');
      expect(skippedDeviation?.details.skippedStages).toContain('Proposal');
    });

    it('should detect backward movement', () => {
      const stageHistory = [
        { stageId: 'stage-1', timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-3', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-2', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      ];

      const result = scoringEngine.analyzeDeal(mockDeal, mockPipeline, stageHistory);

      const backwardDeviation = result.deviations.find((d) => d.type === 'BACKWARD_MOVEMENT');
      expect(backwardDeviation).toBeDefined();
      expect(backwardDeviation?.details.previousStage).toBe('Proposal');
      expect(backwardDeviation?.details.currentStage).toBe('Discovery');
    });

    it('should not flag closed deals as stalled', () => {
      mockDeal.properties.dealstage = 'stage-5';
      const stalledDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      mockDeal.properties.hs_lastmodifieddate = stalledDate.toISOString();

      const stageHistory = [
        { stageId: 'stage-1', timestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-5', timestamp: stalledDate },
      ];

      const result = scoringEngine.analyzeDeal(mockDeal, mockPipeline, stageHistory);

      const stalledDeviation = result.deviations.find((d) => d.type === 'STALLED_DEAL');
      expect(stalledDeviation).toBeUndefined();
    });
  });

  describe('calculateOverallRisk', () => {
    it('should calculate HIGH risk for multiple deviations', () => {
      mockDeal.properties.dealstage = 'stage-4';
      const stalledDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      mockDeal.properties.hs_lastmodifieddate = stalledDate.toISOString();

      const stageHistory = [
        { stageId: 'stage-1', timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-4', timestamp: stalledDate },
      ];

      const result = scoringEngine.analyzeDeal(mockDeal, mockPipeline, stageHistory);

      expect(result.deviations.length).toBeGreaterThanOrEqual(2);
      expect(['HIGH', 'CRITICAL']).toContain(result.overallRiskLevel);
    });
  });

  describe('calculatePipelineMetrics', () => {
    it('should calculate stage metrics from deal history', () => {
      const deals: Deal[] = [
        {
          id: 'deal-1',
          properties: {
            dealname: 'Deal 1',
            dealstage: 'stage-5',
            pipeline: 'pipeline-1',
            createdate: new Date().toISOString(),
            hs_lastmodifieddate: new Date().toISOString(),
            hs_is_closed_won: 'true',
            hs_is_closed: 'true',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          archived: false,
        },
        {
          id: 'deal-2',
          properties: {
            dealname: 'Deal 2',
            dealstage: 'stage-5',
            pipeline: 'pipeline-1',
            createdate: new Date().toISOString(),
            hs_lastmodifieddate: new Date().toISOString(),
            hs_is_closed_won: 'true',
            hs_is_closed: 'true',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          archived: false,
        },
      ];

      const stageHistories = new Map<string, Array<{ stageId: string; timestamp: Date }>>();
      stageHistories.set('deal-1', [
        { stageId: 'stage-1', timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-2', timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-3', timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-4', timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-5', timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      ]);
      stageHistories.set('deal-2', [
        { stageId: 'stage-1', timestamp: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-2', timestamp: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-3', timestamp: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-4', timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
        { stageId: 'stage-5', timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
      ]);

      const metrics = scoringEngine.calculatePipelineMetrics(deals, mockPipeline, stageHistories);

      expect(metrics.pipelineId).toBe('pipeline-1');
      expect(metrics.winRate).toBe(1);
      expect(metrics.stageMetrics.size).toBeGreaterThan(0);
    });
  });
});
