export interface CrmCardRequest {
  associatedObjectId: string;
  associatedObjectType: string;
  portalId: string;
  userId?: string;
  userEmail?: string;
}

export interface CrmCardAction {
  type: 'IFRAME' | 'ACTION_HOOK' | 'CONFIRMATION_ACTION_HOOK';
  width?: number;
  height?: number;
  url?: string;
  label: string;
  httpMethod?: string;
  confirmationMessage?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

export interface CrmCardSection {
  id: string;
  title: string;
  linkUrl?: string;
  topLevelActions?: CrmCardAction[];
  secondaryActions?: CrmCardAction[];
}

export interface CrmCardProperty {
  label: string;
  dataType: 'STRING' | 'LINK' | 'NUMERIC' | 'DATE' | 'DATETIME' | 'EMAIL' | 'PHONE' | 'CURRENCY' | 'STATUS';
  value: string | number;
  optionsMap?: Record<string, { type: 'DEFAULT' | 'SUCCESS' | 'WARNING' | 'DANGER'; label: string }>;
}

export interface CrmCardResponse {
  results: CrmCardResult[];
  primaryAction?: CrmCardAction;
  secondaryActions?: CrmCardAction[];
}

export interface CrmCardResult {
  objectId: number;
  title: string;
  link?: string;
  properties: CrmCardProperty[];
  actions?: CrmCardAction[];
}
