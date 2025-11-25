import { Client } from '@hubspot/api-client';
import { Deviation, DealScore } from '../types';

export class TimelineService {
  private hubspotClient: Client;
  private eventTemplateId?: string;

  constructor(accessToken: string) {
    this.hubspotClient = new Client({ accessToken });
  }

  async createTimelineEvent(
    dealId: string,
    dealScore: DealScore
  ): Promise<void> {
    if (!this.eventTemplateId) {
      console.warn('Timeline event template ID not configured. Skipping event creation.');
      return;
    }

    const eventData = {
      eventTemplateId: this.eventTemplateId,
      objectId: dealId,
      tokens: {
        riskLevel: dealScore.overallRiskLevel,
        riskScore: dealScore.riskScore.toString(),
        deviationCount: dealScore.deviations.length.toString(),
        deviationSummary: this.formatDeviationSummary(dealScore.deviations),
      },
    };

    try {
      await this.hubspotClient.crm.timeline.eventsApi.create(eventData);
    } catch (error) {
      console.error('Failed to create timeline event:', error);
    }
  }

  async createDeviationDetectedEvent(
    dealId: string,
    deviation: Deviation
  ): Promise<void> {
    if (!this.eventTemplateId) {
      return;
    }

    const eventData = {
      eventTemplateId: this.eventTemplateId,
      objectId: dealId,
      tokens: {
        deviationType: deviation.type,
        riskLevel: deviation.riskLevel,
        description: deviation.description,
        recommendation: deviation.recommendation,
      },
    };

    try {
      await this.hubspotClient.crm.timeline.eventsApi.create(eventData);
    } catch (error) {
      console.error('Failed to create deviation event:', error);
    }
  }

  setEventTemplateId(templateId: string): void {
    this.eventTemplateId = templateId;
  }

  private formatDeviationSummary(deviations: Deviation[]): string {
    if (deviations.length === 0) {
      return 'No deviations detected';
    }

    return deviations
      .map((d) => `• ${d.type}: ${d.description}`)
      .join('\n');
  }
}
