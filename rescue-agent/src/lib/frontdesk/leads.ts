import type { TenantConfig } from './config/schema';
import type { ExtractedSlots, Intent, LeadCategory, LeadDraft, LeadPriority } from './types';

/**
 * LEAD CLASSIFICATION AND HIGH-VALUE DETECTION (§VIII, §IX)
 *
 * Two decisions live here, both configurable per restaurant because the same
 * enquiry means very different things at different venues:
 *
 *   - WHAT KIND of opportunity this is.
 *   - HOW URGENTLY a human should see it.
 *
 * The estimated value is deliberately crude and deliberately labelled. It
 * exists so an owner can rank today's twelve leads, not so anyone can claim
 * the software generated a precise dollar figure. When the restaurant has not
 * supplied an average check, the estimate is null rather than invented — a
 * made-up number here would poison every report downstream (§XIV).
 */

const INTENT_TO_CATEGORY: Partial<Record<Intent, LeadCategory>> = {
  RESERVATION: 'RESERVATION',
  RESERVATION_CHANGE: 'RESERVATION',
  LARGE_PARTY: 'LARGE_PARTY',
  CATERING: 'CATERING',
  PRIVATE_EVENT: 'PRIVATE_EVENT',
  TAKEOUT: 'TAKEOUT',
  DELIVERY: 'DELIVERY',
  COMPLAINT: 'COMPLAINT_RECOVERY',
  MANAGER_REQUEST: 'COMPLAINT_RECOVERY',
};

export function categoriseLead(intent: Intent, slots: ExtractedSlots, config: TenantConfig): LeadCategory {
  const base = INTENT_TO_CATEGORY[intent] ?? 'GENERAL';
  // A reservation big enough to need special handling is a large-party lead,
  // whatever words the customer happened to use.
  if (base === 'RESERVATION' && slots.partySize && slots.partySize >= config.thresholds.largePartySize) {
    return 'LARGE_PARTY';
  }
  return base;
}

/** Categories that always outrank an ordinary table booking. */
const HIGH_VALUE_CATEGORIES: LeadCategory[] = ['CATERING', 'PRIVATE_EVENT', 'LARGE_PARTY'];

export function isHighValue(category: LeadCategory, slots: ExtractedSlots, config: TenantConfig): boolean {
  if (HIGH_VALUE_CATEGORIES.includes(category)) return true;
  if (slots.partySize && slots.partySize >= config.thresholds.highPriorityPartySize) return true;
  return false;
}

export function prioritiseLead(
  category: LeadCategory,
  slots: ExtractedSlots,
  config: TenantConfig,
): LeadPriority {
  if (category === 'COMPLAINT_RECOVERY') return 'URGENT';
  if (category === 'CATERING' || category === 'PRIVATE_EVENT') return 'URGENT';
  if (slots.partySize && slots.partySize >= config.thresholds.highPriorityPartySize) return 'URGENT';
  if (isHighValue(category, slots, config)) return 'HIGH';
  return 'STANDARD';
}

/**
 * ESTIMATED opportunity value in cents, or null when it cannot be grounded in
 * configured data. Never call this "revenue".
 */
export function estimateValueCents(
  category: LeadCategory,
  slots: ExtractedSlots,
  config: TenantConfig,
): number | null {
  const { averageCheckCents, cateringMinimumCents, privateEventMinimumCents, largePartySize } = config.thresholds;

  if (category === 'CATERING') {
    if (cateringMinimumCents) return cateringMinimumCents;
    if (averageCheckCents && slots.partySize) return averageCheckCents * slots.partySize;
    return null;
  }

  if (category === 'PRIVATE_EVENT') {
    if (privateEventMinimumCents) return privateEventMinimumCents;
    if (averageCheckCents && slots.partySize) return averageCheckCents * slots.partySize;
    return null;
  }

  if (!averageCheckCents) return null;

  if (category === 'RESERVATION' || category === 'LARGE_PARTY') {
    // Without a stated party size, assume the smallest booking the restaurant
    // considers ordinary rather than an optimistic one.
    const size = slots.partySize ?? (category === 'LARGE_PARTY' ? largePartySize : 2);
    return averageCheckCents * size;
  }

  if (category === 'TAKEOUT' || category === 'DELIVERY') {
    return averageCheckCents * (slots.partySize ?? 1);
  }

  // GENERAL and COMPLAINT_RECOVERY carry no defensible dollar estimate.
  return null;
}

export function buildLeadDraft(
  intent: Intent,
  slots: ExtractedSlots,
  config: TenantConfig,
  notes: string,
): LeadDraft {
  const category = categoriseLead(intent, slots, config);
  return {
    category,
    intent,
    priority: prioritiseLead(category, slots, config),
    customerName: slots.customerName,
    phone: slots.phone,
    email: slots.email,
    partySize: slots.partySize,
    requestedDate: slots.requestedDate ?? slots.requestedDateText,
    requestedTime: slots.requestedTime,
    notes,
    estimatedValueCents: estimateValueCents(category, slots, config),
  };
}

/** Intents worth capturing as a revenue opportunity at all. */
const LEAD_GENERATING: Intent[] = [
  'RESERVATION',
  'RESERVATION_CHANGE',
  'LARGE_PARTY',
  'CATERING',
  'PRIVATE_EVENT',
  'TAKEOUT',
  'DELIVERY',
  'COMPLAINT',
];

export function isLeadGenerating(intent: Intent): boolean {
  return LEAD_GENERATING.includes(intent);
}

/**
 * A lead is only worth writing once it carries a way to reach the customer.
 * Rows with no name, phone or email are noise in the owner's pipeline and make
 * the dashboard look busier than the business actually is.
 */
export function hasContactPath(slots: ExtractedSlots): boolean {
  return Boolean(slots.phone || slots.email);
}

export function formatCurrency(cents: number | null): string {
  if (cents === null) return '—';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
