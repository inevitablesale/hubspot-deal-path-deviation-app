export interface Deal {
  id: string;
  properties: DealProperties;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface DealProperties {
  dealname: string;
  dealstage: string;
  pipeline: string;
  amount?: string;
  closedate?: string;
  createdate: string;
  hs_lastmodifieddate: string;
  hs_deal_stage_probability?: string;
  hs_is_closed_won?: string;
  hs_is_closed?: string;
  [key: string]: string | undefined;
}

export interface PipelineStage {
  id: string;
  label: string;
  displayOrder: number;
  metadata: {
    probability?: string;
    isClosed?: string;
  };
}

export interface Pipeline {
  id: string;
  label: string;
  stages: PipelineStage[];
}

export interface StageHistory {
  stageId: string;
  stageName: string;
  timestamp: Date;
  duration?: number;
}

export interface DealStageChange {
  dealId: string;
  previousStage: string;
  currentStage: string;
  timestamp: Date;
  stageOrder: number;
  previousStageOrder: number;
}
