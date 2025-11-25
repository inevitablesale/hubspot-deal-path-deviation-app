import { Client } from '@hubspot/api-client';
import { Deal, Pipeline, PipelineStage } from '../types';

export class DealService {
  private hubspotClient: Client;

  constructor(accessToken: string) {
    this.hubspotClient = new Client({ accessToken });
  }

  async getDeal(dealId: string): Promise<Deal> {
    const response = await this.hubspotClient.crm.deals.basicApi.getById(dealId, [
      'dealname',
      'dealstage',
      'pipeline',
      'amount',
      'closedate',
      'createdate',
      'hs_lastmodifieddate',
      'hs_deal_stage_probability',
      'hs_is_closed_won',
      'hs_is_closed',
    ]);

    return {
      id: response.id,
      properties: response.properties as Deal['properties'],
      createdAt: response.createdAt.toISOString(),
      updatedAt: response.updatedAt.toISOString(),
      archived: response.archived || false,
    };
  }

  async getDeals(limit = 100, after?: string): Promise<{ deals: Deal[]; paging?: { next?: { after: string } } }> {
    const response = await this.hubspotClient.crm.deals.basicApi.getPage(
      limit,
      after,
      [
        'dealname',
        'dealstage',
        'pipeline',
        'amount',
        'closedate',
        'createdate',
        'hs_lastmodifieddate',
        'hs_deal_stage_probability',
        'hs_is_closed_won',
        'hs_is_closed',
      ]
    );

    const deals = response.results.map((deal) => ({
      id: deal.id,
      properties: deal.properties as Deal['properties'],
      createdAt: deal.createdAt.toISOString(),
      updatedAt: deal.updatedAt.toISOString(),
      archived: deal.archived || false,
    }));

    return {
      deals,
      paging: response.paging,
    };
  }

  async getPipeline(pipelineId: string): Promise<Pipeline> {
    const response = await this.hubspotClient.crm.pipelines.pipelinesApi.getById('deals', pipelineId);

    const stages: PipelineStage[] = response.stages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      displayOrder: stage.displayOrder,
      metadata: {
        probability: stage.metadata?.probability,
        isClosed: stage.metadata?.isClosed,
      },
    }));

    stages.sort((a, b) => a.displayOrder - b.displayOrder);

    return {
      id: response.id,
      label: response.label,
      stages,
    };
  }

  async getAllPipelines(): Promise<Pipeline[]> {
    const response = await this.hubspotClient.crm.pipelines.pipelinesApi.getAll('deals');

    return response.results.map((pipeline) => {
      const stages: PipelineStage[] = pipeline.stages.map((stage) => ({
        id: stage.id,
        label: stage.label,
        displayOrder: stage.displayOrder,
        metadata: {
          probability: stage.metadata?.probability,
          isClosed: stage.metadata?.isClosed,
        },
      }));

      stages.sort((a, b) => a.displayOrder - b.displayOrder);

      return {
        id: pipeline.id,
        label: pipeline.label,
        stages,
      };
    });
  }

  async updateDealProperties(dealId: string, properties: Record<string, string>): Promise<Deal> {
    const response = await this.hubspotClient.crm.deals.basicApi.update(dealId, { properties });

    return {
      id: response.id,
      properties: response.properties as Deal['properties'],
      createdAt: response.createdAt.toISOString(),
      updatedAt: response.updatedAt.toISOString(),
      archived: response.archived || false,
    };
  }

  async getDealStageHistory(dealId: string): Promise<Array<{ stageId: string; timestamp: Date }>> {
    try {
      const response = await this.hubspotClient.crm.deals.basicApi.getById(
        dealId,
        ['dealstage'],
        undefined,
        undefined,
        false,
        'property_dealstage'
      );

      const history: Array<{ stageId: string; timestamp: Date }> = [];

      if (response.propertiesWithHistory?.dealstage) {
        for (const historyEntry of response.propertiesWithHistory.dealstage) {
          history.push({
            stageId: historyEntry.value,
            timestamp: new Date(historyEntry.timestamp),
          });
        }
      }

      history.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      return history;
    } catch {
      return [];
    }
  }
}
