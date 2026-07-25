export type EvidenceType =
  | 'BUSINESS_IDENTITY'
  | 'PHONE_VISIBILITY'
  | 'CLICK_TO_CALL'
  | 'HOURS_VISIBILITY'
  | 'ADDRESS_VISIBILITY'
  | 'MENU_ACCESS'
  | 'RESERVATION_PATH'
  | 'ORDERING_PATH'
  | 'CONTACT_PATH'
  | 'CATERING_PATH'
  | 'PRIVATE_DINING_PATH'
  | 'LOYALTY_SIGNAL'
  | 'EMAIL_CAPTURE'
  | 'SMS_CAPTURE'
  | 'FAQ_SIGNAL'
  | 'SOCIAL_LINK'
  | 'CTA_SIGNAL'
  | 'BROKEN_LINK'
  | 'TECHNICAL_SIGNAL'
  | 'MOBILE_SIGNAL'
  | 'GIFT_CARD_SIGNAL'
  | 'REVIEW_SIGNAL'
  | 'RESERVATION_PLATFORM'
  | 'ORDERING_PLATFORM'
  | 'COLLECTION_FAILURE'
  | 'UNKNOWN';

export interface EvidenceInput {
  sourceUrl: string | null;
  evidenceType: EvidenceType;
  fact: string;
  supportingContext: string | null;
  confidence: number; // 0-100
}

export type JourneyStageName =
  | 'DISCOVERY'
  | 'WEBSITE'
  | 'PHONE'
  | 'MENU'
  | 'RESERVATION'
  | 'ORDERING'
  | 'CONTACT'
  | 'FOLLOW_UP'
  | 'REVIEW'
  | 'RETURN';

export type JourneyStatus = 'HEALTHY' | 'FRICTION' | 'RISK' | 'UNKNOWN';

export interface JourneyStageResult {
  stage: JourneyStageName;
  status: JourneyStatus;
  finding: string;
  confidence: number;
  manualValidationRequired: boolean;
  evidenceIds: string[];
}

export interface OpportunityInput {
  category: string;
  title: string;
  problem: string;
  businessImpact: string;
  customerJourneyStage: JourneyStageName;
  evidenceIds: string[];
  impactScore: number;
  urgencyScore: number;
  confidenceScore: number;
  aiFitScore: number;
  recommendedSolution: string;
  manualValidationRequired: boolean;
}

export type ScoreCategory =
  | 'DIGITAL_CUSTOMER_JOURNEY'
  | 'WEBSITE_CONVERSION'
  | 'PHONE_RESPONSE_READINESS'
  | 'RESERVATION_EXPERIENCE'
  | 'ONLINE_ORDERING_EXPERIENCE'
  | 'REVIEW_REPUTATION_SYSTEM'
  | 'LOCAL_DIGITAL_PRESENCE'
  | 'CUSTOMER_RETENTION'
  | 'AI_AUTOMATION_READINESS';

export interface CategoryScoreInput {
  category: ScoreCategory;
  weight: number; // integer percent
  score: number | null;
  confidence: number;
  insufficientData: boolean;
  explanation: string;
}

export const SCORE_WEIGHTS: Record<ScoreCategory, number> = {
  DIGITAL_CUSTOMER_JOURNEY: 15,
  WEBSITE_CONVERSION: 15,
  PHONE_RESPONSE_READINESS: 15,
  RESERVATION_EXPERIENCE: 10,
  ONLINE_ORDERING_EXPERIENCE: 10,
  REVIEW_REPUTATION_SYSTEM: 10,
  LOCAL_DIGITAL_PRESENCE: 10,
  CUSTOMER_RETENTION: 10,
  AI_AUTOMATION_READINESS: 5,
};

export interface EvidenceRecordLike {
  id: string;
  evidenceType: string;
  fact: string;
  supportingContext: string | null;
  confidence: number;
  sourceUrl?: string | null;
}
