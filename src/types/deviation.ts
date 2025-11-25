export type DeviationType =
  | 'STALLED_DEAL'
  | 'SKIPPED_STAGE'
  | 'ABNORMAL_TIME_IN_STAGE'
  | 'BACKWARD_MOVEMENT';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Deviation {
  type: DeviationType;
  riskLevel: RiskLevel;
  description: string;
  details: DeviationDetails;
  detectedAt: Date;
  recommendation: string;
}

export interface DeviationDetails {
  currentStage?: string;
  previousStage?: string;
  skippedStages?: string[];
  daysInStage?: number;
  expectedDays?: number;
  averageDays?: number;
}

export interface DealScore {
  dealId: string;
  overallRiskLevel: RiskLevel;
  riskScore: number;
  deviations: Deviation[];
  lastAnalyzedAt: Date;
}

export interface ScoringConfig {
  stalledDaysThreshold: number;
  abnormalTimeMultiplier: number;
  skipStageWeight: number;
  backwardMovementWeight: number;
  stalledDealWeight: number;
  abnormalTimeWeight: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  stalledDaysThreshold: 14,
  abnormalTimeMultiplier: 2.0,
  skipStageWeight: 30,
  backwardMovementWeight: 40,
  stalledDealWeight: 25,
  abnormalTimeWeight: 20,
};
