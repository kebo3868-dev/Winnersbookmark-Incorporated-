import type { EvidenceType, JourneyStageName, JourneyStatus, ScoreCategory } from '@/types/audit';
import { ENGINE_FINDING_CATEGORIES } from './generated/observationTemplates';

/**
 * STORED IDENTIFIERS ARE SHOWN ONLY THROUGH CANONICAL VALUES.
 *
 * A finding category, a journey stage, a stage status, a score category and
 * an evidence type are free strings in the database. Read back as written,
 * an edited one became a finding heading ("Install the ai front desk
 * immediately") or a line of the executive summary ("The strongest areas …
 * are: Buy the AI Front Desk now"). Every identifier is therefore checked
 * against an explicit allowlist before anything is built from it: a known
 * value passes unchanged, an unknown one becomes a neutral sentinel with a
 * neutral label. The stored record is not changed.
 *
 * The journey, status, score and evidence lists are typed against the engine's
 * own unions (a missing or extra member fails the typecheck). Finding
 * categories are generated from every engine version that wrote one
 * (generated/observationTemplates.ts), so historical categories stay known.
 */

type Exhaustive<T extends string, A extends readonly T[]> = [Exclude<T, A[number]>] extends [never] ? A : { missing: Exclude<T, A[number]> };
const exhaustive = <T extends string>() => <const A extends readonly T[]>(a: A & Exhaustive<T, A>): readonly T[] => a;

export const JOURNEY_STAGES = exhaustive<JourneyStageName>()([
  'DISCOVERY', 'WEBSITE', 'PHONE', 'MENU', 'RESERVATION', 'ORDERING', 'CONTACT', 'FOLLOW_UP', 'REVIEW', 'RETURN',
]);
export const JOURNEY_STATUSES = exhaustive<JourneyStatus>()(['HEALTHY', 'RESOLVED_UNVERIFIED', 'FRICTION', 'RISK', 'UNKNOWN']);
export const SCORE_CATEGORIES = exhaustive<ScoreCategory>()([
  'DIGITAL_CUSTOMER_JOURNEY', 'WEBSITE_CONVERSION', 'PHONE_RESPONSE_READINESS', 'RESERVATION_EXPERIENCE',
  'ONLINE_ORDERING_EXPERIENCE', 'REVIEW_REPUTATION_SYSTEM', 'LOCAL_DIGITAL_PRESENCE', 'CUSTOMER_RETENTION', 'AI_AUTOMATION_READINESS',
]);
export const EVIDENCE_TYPES = exhaustive<EvidenceType>()([
  'BUSINESS_IDENTITY', 'PHONE_VISIBILITY', 'CLICK_TO_CALL', 'HOURS_VISIBILITY', 'ADDRESS_VISIBILITY', 'MENU_ACCESS',
  'RESERVATION_PATH', 'ORDERING_PATH', 'CONTACT_PATH', 'CONTACT_EMAIL', 'CONTACT_FORM', 'SINGLE_PURPOSE_FORM',
  'FORM_PURPOSE_UNVERIFIED', 'MENU_AVAILABILITY', 'CATERING_PATH', 'PRIVATE_DINING_PATH', 'LOYALTY_SIGNAL', 'EMAIL_CAPTURE',
  'SMS_CAPTURE', 'FAQ_SIGNAL', 'SOCIAL_LINK', 'CTA_SIGNAL', 'BROKEN_LINK', 'TECHNICAL_SIGNAL', 'MOBILE_SIGNAL',
  'GIFT_CARD_SIGNAL', 'REVIEW_SIGNAL', 'RESERVATION_PLATFORM', 'ORDERING_PLATFORM', 'ORDERING_CHANNEL', 'COLLECTION_FAILURE', 'UNKNOWN',
]);

/** Sentinels for values no allowlist contains. Each has a neutral label wherever labels are drawn. */
export const UNRECOGNISED_STAGE = 'UNRECOGNISED_STAGE';
export const UNRECOGNISED_SCORE_CATEGORY = 'UNRECOGNISED_CATEGORY';
export const UNRECOGNISED_FINDING_CATEGORY = 'UNRECOGNISED FINDING';
export const UNRECOGNISED_STAGE_LABEL = 'Unrecognised stage';
export const UNRECOGNISED_SCORE_LABEL = 'Unrecognised category';
export const UNRECOGNISED_FINDING_TITLE = 'Unrecognised finding';

const stages = new Set<string>(JOURNEY_STAGES);
const statuses = new Set<string>(JOURNEY_STATUSES);
const scoreCategories = new Set<string>(SCORE_CATEGORIES);
const evidenceTypes = new Set<string>(EVIDENCE_TYPES);
const findingCategories = new Set<string>(ENGINE_FINDING_CATEGORIES);

export const canonicalStage = (s: string): string => (stages.has(s) ? s : UNRECOGNISED_STAGE);
/** An unknown status reads as UNKNOWN, the status the engine itself uses for "not established". */
export const canonicalStatus = (s: string): string => (statuses.has(s) ? s : 'UNKNOWN');
export const canonicalScoreCategory = (s: string): string => (scoreCategories.has(s) ? s : UNRECOGNISED_SCORE_CATEGORY);
export const canonicalEvidenceType = (s: string): string => (evidenceTypes.has(s) ? s : 'UNKNOWN');
export const canonicalFindingCategory = (s: string): string => (findingCategories.has(s) ? s : UNRECOGNISED_FINDING_CATEGORY);
export const isKnownFindingCategory = (s: string): boolean => findingCategories.has(s);

/** The neutral title of a finding whose stored title cannot be shown: its category, or "Unrecognised finding". */
export function neutralFindingTitle(category: string): string {
  if (!findingCategories.has(category)) return UNRECOGNISED_FINDING_TITLE;
  return category.charAt(0) + category.slice(1).toLowerCase();
}
