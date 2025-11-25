import {
  Deal,
  Pipeline,
  PipelineStage,
  Deviation,
  DeviationType,
  RiskLevel,
  DealScore,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
} from '../types';

export interface StageMetrics {
  stageId: string;
  averageDaysInStage: number;
  medianDaysInStage: number;
  standardDeviation: number;
}

export interface PipelineMetrics {
  pipelineId: string;
  stageMetrics: Map<string, StageMetrics>;
  averageStagesToClose: number;
  winRate: number;
}

export class ScoringEngine {
  private config: ScoringConfig;

  constructor(config: ScoringConfig = DEFAULT_SCORING_CONFIG) {
    this.config = config;
  }

  analyzeDeal(
    deal: Deal,
    pipeline: Pipeline,
    stageHistory: Array<{ stageId: string; timestamp: Date }>,
    pipelineMetrics?: PipelineMetrics
  ): DealScore {
    const deviations: Deviation[] = [];

    const stalledDeviation = this.detectStalledDeal(deal, pipeline, pipelineMetrics);
    if (stalledDeviation) {
      deviations.push(stalledDeviation);
    }

    const skippedStagesDeviation = this.detectSkippedStages(stageHistory, pipeline);
    if (skippedStagesDeviation) {
      deviations.push(skippedStagesDeviation);
    }

    const backwardMovementDeviation = this.detectBackwardMovement(stageHistory, pipeline);
    if (backwardMovementDeviation) {
      deviations.push(backwardMovementDeviation);
    }

    const abnormalTimeDeviation = this.detectAbnormalTimeInStage(
      deal,
      pipeline,
      stageHistory,
      pipelineMetrics
    );
    if (abnormalTimeDeviation) {
      deviations.push(abnormalTimeDeviation);
    }

    const { overallRiskLevel, riskScore } = this.calculateOverallRisk(deviations);

    return {
      dealId: deal.id,
      overallRiskLevel,
      riskScore,
      deviations,
      lastAnalyzedAt: new Date(),
    };
  }

  private detectStalledDeal(
    deal: Deal,
    pipeline: Pipeline,
    pipelineMetrics?: PipelineMetrics
  ): Deviation | null {
    const currentStage = pipeline.stages.find((s) => s.id === deal.properties.dealstage);
    if (!currentStage || currentStage.metadata.isClosed === 'true') {
      return null;
    }

    const lastModified = new Date(deal.properties.hs_lastmodifieddate);
    const daysInStage = Math.floor((Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24));

    let threshold = this.config.stalledDaysThreshold;
    if (pipelineMetrics) {
      const stageMetric = pipelineMetrics.stageMetrics.get(currentStage.id);
      if (stageMetric) {
        threshold = Math.max(
          stageMetric.averageDaysInStage + stageMetric.standardDeviation,
          this.config.stalledDaysThreshold
        );
      }
    }

    if (daysInStage > threshold) {
      const riskLevel = this.calculateStalledRiskLevel(daysInStage, threshold);

      return {
        type: 'STALLED_DEAL' as DeviationType,
        riskLevel,
        description: `Deal has been in "${currentStage.label}" stage for ${daysInStage} days (threshold: ${Math.round(threshold)} days)`,
        details: {
          currentStage: currentStage.label,
          daysInStage,
          expectedDays: Math.round(threshold),
        },
        detectedAt: new Date(),
        recommendation: this.getStalledDealRecommendation(currentStage, daysInStage),
      };
    }

    return null;
  }

  private detectSkippedStages(
    stageHistory: Array<{ stageId: string; timestamp: Date }>,
    pipeline: Pipeline
  ): Deviation | null {
    if (stageHistory.length < 2) {
      return null;
    }

    const stageOrderMap = new Map<string, number>();
    pipeline.stages.forEach((stage, index) => {
      stageOrderMap.set(stage.id, index);
    });

    const skippedStages: string[] = [];

    for (let i = 1; i < stageHistory.length; i++) {
      const previousStageOrder = stageOrderMap.get(stageHistory[i - 1].stageId);
      const currentStageOrder = stageOrderMap.get(stageHistory[i].stageId);

      if (previousStageOrder !== undefined && currentStageOrder !== undefined) {
        if (currentStageOrder > previousStageOrder + 1) {
          for (let j = previousStageOrder + 1; j < currentStageOrder; j++) {
            const skippedStage = pipeline.stages.find((s) => stageOrderMap.get(s.id) === j);
            if (skippedStage) {
              skippedStages.push(skippedStage.label);
            }
          }
        }
      }
    }

    if (skippedStages.length > 0) {
      const riskLevel = this.calculateSkippedStagesRiskLevel(skippedStages.length);

      return {
        type: 'SKIPPED_STAGE' as DeviationType,
        riskLevel,
        description: `Deal skipped ${skippedStages.length} stage(s): ${skippedStages.join(', ')}`,
        details: {
          skippedStages,
        },
        detectedAt: new Date(),
        recommendation: this.getSkippedStagesRecommendation(skippedStages),
      };
    }

    return null;
  }

  private detectBackwardMovement(
    stageHistory: Array<{ stageId: string; timestamp: Date }>,
    pipeline: Pipeline
  ): Deviation | null {
    if (stageHistory.length < 2) {
      return null;
    }

    const stageOrderMap = new Map<string, number>();
    pipeline.stages.forEach((stage, index) => {
      stageOrderMap.set(stage.id, index);
    });

    for (let i = 1; i < stageHistory.length; i++) {
      const previousStageOrder = stageOrderMap.get(stageHistory[i - 1].stageId);
      const currentStageOrder = stageOrderMap.get(stageHistory[i].stageId);

      if (previousStageOrder !== undefined && currentStageOrder !== undefined) {
        if (currentStageOrder < previousStageOrder) {
          const previousStage = pipeline.stages.find(
            (s) => stageOrderMap.get(s.id) === previousStageOrder
          );
          const currentStage = pipeline.stages.find(
            (s) => stageOrderMap.get(s.id) === currentStageOrder
          );

          return {
            type: 'BACKWARD_MOVEMENT' as DeviationType,
            riskLevel: 'HIGH',
            description: `Deal moved backward from "${previousStage?.label}" to "${currentStage?.label}"`,
            details: {
              previousStage: previousStage?.label,
              currentStage: currentStage?.label,
            },
            detectedAt: new Date(),
            recommendation: this.getBackwardMovementRecommendation(
              previousStage?.label || '',
              currentStage?.label || ''
            ),
          };
        }
      }
    }

    return null;
  }

  private detectAbnormalTimeInStage(
    deal: Deal,
    pipeline: Pipeline,
    stageHistory: Array<{ stageId: string; timestamp: Date }>,
    pipelineMetrics?: PipelineMetrics
  ): Deviation | null {
    if (!pipelineMetrics || stageHistory.length === 0) {
      return null;
    }

    const currentStage = pipeline.stages.find((s) => s.id === deal.properties.dealstage);
    if (!currentStage || currentStage.metadata.isClosed === 'true') {
      return null;
    }

    const stageMetric = pipelineMetrics.stageMetrics.get(currentStage.id);
    if (!stageMetric) {
      return null;
    }

    const lastStageEntry = stageHistory.filter((h) => h.stageId === currentStage.id).pop();
    if (!lastStageEntry) {
      return null;
    }

    const daysInStage = Math.floor(
      (Date.now() - lastStageEntry.timestamp.getTime()) / (1000 * 60 * 60 * 24)
    );

    const abnormalThreshold = stageMetric.averageDaysInStage * this.config.abnormalTimeMultiplier;

    if (daysInStage > abnormalThreshold) {
      const riskLevel = this.calculateAbnormalTimeRiskLevel(daysInStage, stageMetric.averageDaysInStage);

      return {
        type: 'ABNORMAL_TIME_IN_STAGE' as DeviationType,
        riskLevel,
        description: `Deal has been in "${currentStage.label}" for ${daysInStage} days, which is ${Math.round((daysInStage / stageMetric.averageDaysInStage) * 100)}% of the average`,
        details: {
          currentStage: currentStage.label,
          daysInStage,
          averageDays: Math.round(stageMetric.averageDaysInStage),
        },
        detectedAt: new Date(),
        recommendation: this.getAbnormalTimeRecommendation(currentStage.label, daysInStage, stageMetric.averageDaysInStage),
      };
    }

    return null;
  }

  private calculateOverallRisk(deviations: Deviation[]): { overallRiskLevel: RiskLevel; riskScore: number } {
    if (deviations.length === 0) {
      return { overallRiskLevel: 'LOW', riskScore: 0 };
    }

    let totalScore = 0;

    for (const deviation of deviations) {
      let weight = 0;

      switch (deviation.type) {
        case 'STALLED_DEAL':
          weight = this.config.stalledDealWeight;
          break;
        case 'SKIPPED_STAGE':
          weight = this.config.skipStageWeight;
          break;
        case 'BACKWARD_MOVEMENT':
          weight = this.config.backwardMovementWeight;
          break;
        case 'ABNORMAL_TIME_IN_STAGE':
          weight = this.config.abnormalTimeWeight;
          break;
      }

      const riskMultiplier = this.getRiskLevelMultiplier(deviation.riskLevel);
      totalScore += weight * riskMultiplier;
    }

    const riskScore = Math.min(100, totalScore);
    const overallRiskLevel = this.scoreToRiskLevel(riskScore);

    return { overallRiskLevel, riskScore };
  }

  private getRiskLevelMultiplier(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case 'LOW':
        return 0.5;
      case 'MEDIUM':
        return 1;
      case 'HIGH':
        return 1.5;
      case 'CRITICAL':
        return 2;
    }
  }

  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MEDIUM';
    return 'LOW';
  }

  private calculateStalledRiskLevel(daysInStage: number, threshold: number): RiskLevel {
    const ratio = daysInStage / threshold;
    if (ratio >= 3) return 'CRITICAL';
    if (ratio >= 2) return 'HIGH';
    if (ratio >= 1.5) return 'MEDIUM';
    return 'LOW';
  }

  private calculateSkippedStagesRiskLevel(skippedCount: number): RiskLevel {
    if (skippedCount >= 3) return 'CRITICAL';
    if (skippedCount >= 2) return 'HIGH';
    return 'MEDIUM';
  }

  private calculateAbnormalTimeRiskLevel(daysInStage: number, averageDays: number): RiskLevel {
    const ratio = daysInStage / averageDays;
    if (ratio >= 4) return 'CRITICAL';
    if (ratio >= 3) return 'HIGH';
    if (ratio >= 2) return 'MEDIUM';
    return 'LOW';
  }

  private getStalledDealRecommendation(stage: PipelineStage, daysInStage: number): string {
    if (daysInStage > 30) {
      return `Urgent: This deal has been stalled for over a month. Consider reaching out to the contact immediately or evaluating if this opportunity is still viable.`;
    }
    return `Review the deal progress and schedule a follow-up with the prospect. Consider what actions are needed to move past the "${stage.label}" stage.`;
  }

  private getSkippedStagesRecommendation(skippedStages: string[]): string {
    return `Review if the deal truly meets the criteria for the current stage. The following stages were skipped: ${skippedStages.join(', ')}. Ensure all necessary qualifications and documentation are complete.`;
  }

  private getBackwardMovementRecommendation(fromStage: string, toStage: string): string {
    return `The deal moved backward from "${fromStage}" to "${toStage}". Investigate the reason for this regression and document it. Identify what needs to happen to progress the deal forward again.`;
  }

  private getAbnormalTimeRecommendation(
    stageName: string,
    daysInStage: number,
    averageDays: number
  ): string {
    return `This deal is taking significantly longer than average in the "${stageName}" stage (${daysInStage} days vs ${Math.round(averageDays)} day average). Review blockers and consider escalation.`;
  }

  calculatePipelineMetrics(
    deals: Deal[],
    pipeline: Pipeline,
    stageHistories: Map<string, Array<{ stageId: string; timestamp: Date }>>
  ): PipelineMetrics {
    const stageMetrics = new Map<string, StageMetrics>();

    for (const stage of pipeline.stages) {
      const daysInStageData: number[] = [];

      for (const deal of deals) {
        const history = stageHistories.get(deal.id);
        if (!history) continue;

        const stageEntries = history.filter((h) => h.stageId === stage.id);
        for (let i = 0; i < stageEntries.length; i++) {
          const start = stageEntries[i].timestamp;
          let end: Date;

          const historyIndex = history.findIndex(
            (h) => h.stageId === stage.id && h.timestamp.getTime() === start.getTime()
          );
          if (historyIndex < history.length - 1) {
            end = history[historyIndex + 1].timestamp;
          } else {
            end = new Date();
          }

          const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (days >= 0) {
            daysInStageData.push(days);
          }
        }
      }

      if (daysInStageData.length > 0) {
        const avg = daysInStageData.reduce((a, b) => a + b, 0) / daysInStageData.length;
        const sorted = [...daysInStageData].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const variance =
          daysInStageData.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
          daysInStageData.length;
        const stdDev = Math.sqrt(variance);

        stageMetrics.set(stage.id, {
          stageId: stage.id,
          averageDaysInStage: avg,
          medianDaysInStage: median,
          standardDeviation: stdDev,
        });
      }
    }

    const wonDeals = deals.filter((d) => d.properties.hs_is_closed_won === 'true');
    const closedDeals = deals.filter((d) => d.properties.hs_is_closed === 'true');

    let averageStagesToClose = 0;
    for (const deal of wonDeals) {
      const history = stageHistories.get(deal.id);
      if (history) {
        const uniqueStages = new Set(history.map((h) => h.stageId));
        averageStagesToClose += uniqueStages.size;
      }
    }
    if (wonDeals.length > 0) {
      averageStagesToClose /= wonDeals.length;
    }

    const winRate = closedDeals.length > 0 ? wonDeals.length / closedDeals.length : 0;

    return {
      pipelineId: pipeline.id,
      stageMetrics,
      averageStagesToClose,
      winRate,
    };
  }
}

export const scoringEngine = new ScoringEngine();
