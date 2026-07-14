/**
 * Draft-order validation — the heart of the human-in-the-loop guarantee.
 *
 * The voice agent's captured order is NEVER trusted blindly. Every requested
 * item is validated against verified menu data here, in pure deterministic
 * code, before a draft is written. Anything uncertain is FLAGGED (not
 * rejected and not silently accepted) so a human reviews it. A draft order is
 * a request for staff review — never a confirmed kitchen order.
 */

/** A menu item as needed for validation (a projection of the DB row). */
export interface MenuItemForValidation {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  isAvailable: boolean;
  requiresStaffConfirmation: boolean;
  allergenEscalationRequired: boolean;
  prepOptions: string[];
  sideOptions: string[];
  modifierOptions: string[];
  requiredSideCount: number;
}

/** A single item as captured by the voice agent. */
export interface CapturedItem {
  menuItemName: string;
  quantity?: number;
  preparation?: string | null;
  sides?: string[];
  modifiers?: string[];
  specialRequests?: string[];
  allergyNote?: string | null;
}

export type ItemFlag =
  | 'UNKNOWN_MENU_ITEM'
  | 'ITEM_UNAVAILABLE'
  | 'INVALID_PREPARATION'
  | 'INVALID_SIDE'
  | 'INVALID_MODIFIER'
  | 'MISSING_REQUIRED_OPTION'
  | 'PRICE_UNAVAILABLE'
  | 'REQUIRES_STAFF_CONFIRMATION'
  | 'ALLERGY_ESCALATION';

export interface ValidatedItem {
  menuItemId: string | null;
  menuItemName: string;
  quantity: number;
  preparation: string | null;
  sides: string[];
  modifiers: string[];
  specialRequests: string[];
  allergyNote: string | null;
  unitPrice: number | null;
  flags: ItemFlag[];
}

export interface ValidatedDraft {
  items: ValidatedItem[];
  requiresHumanReview: boolean;
  reviewReason: string;
  reviewFlags: ItemFlag[];
  allergyFlag: boolean;
  /**
   * ESTIMATED value only — sums known unit prices × quantity. Items with no
   * verified price contribute 0 and are surfaced via PRICE_UNAVAILABLE so the
   * estimate is never presented as a confirmed total.
   */
  estimatedValue: number;
  /** True only when every item priced cleanly with no flags at all. */
  fullyPriced: boolean;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Loose match: exact slug/name, else name containment either direction. */
function findMenuItem(name: string, menu: MenuItemForValidation[]): MenuItemForValidation | null {
  const n = normalize(name);
  if (!n) return null;
  const exact = menu.find((m) => normalize(m.name) === n || normalize(m.slug) === n);
  if (exact) return exact;
  const partial = menu.find((m) => normalize(m.name).includes(n) || n.includes(normalize(m.name)));
  return partial ?? null;
}

function optionAllowed(value: string, allowed: string[]): boolean {
  const v = normalize(value);
  return allowed.some((a) => normalize(a) === v || normalize(a).includes(v) || v.includes(normalize(a)));
}

export function validateCapturedItem(captured: CapturedItem, menu: MenuItemForValidation[]): ValidatedItem {
  const flags: ItemFlag[] = [];
  const quantity = Math.max(1, Math.floor(captured.quantity ?? 1));
  const sides = captured.sides ?? [];
  const modifiers = captured.modifiers ?? [];
  const specialRequests = captured.specialRequests ?? [];
  const allergyNote = captured.allergyNote?.trim() || null;

  const match = findMenuItem(captured.menuItemName, menu);

  if (allergyNote) flags.push('ALLERGY_ESCALATION');

  if (!match) {
    flags.push('UNKNOWN_MENU_ITEM');
    return {
      menuItemId: null,
      menuItemName: captured.menuItemName,
      quantity,
      preparation: captured.preparation?.trim() || null,
      sides,
      modifiers,
      specialRequests,
      allergyNote,
      unitPrice: null,
      flags,
    };
  }

  if (!match.isAvailable) flags.push('ITEM_UNAVAILABLE');
  if (match.requiresStaffConfirmation) flags.push('REQUIRES_STAFF_CONFIRMATION');
  if (match.allergenEscalationRequired && !flags.includes('ALLERGY_ESCALATION')) flags.push('ALLERGY_ESCALATION');
  if (match.price === null) flags.push('PRICE_UNAVAILABLE');

  const preparation = captured.preparation?.trim() || null;
  if (preparation && match.prepOptions.length > 0 && !optionAllowed(preparation, match.prepOptions)) {
    flags.push('INVALID_PREPARATION');
  }

  for (const side of sides) {
    if (match.sideOptions.length > 0 && !optionAllowed(side, match.sideOptions)) {
      flags.push('INVALID_SIDE');
      break;
    }
  }

  for (const mod of modifiers) {
    if (match.modifierOptions.length > 0 && !optionAllowed(mod, match.modifierOptions)) {
      flags.push('INVALID_MODIFIER');
      break;
    }
  }

  if (match.requiredSideCount > 0 && sides.length < match.requiredSideCount) {
    flags.push('MISSING_REQUIRED_OPTION');
  }

  return {
    menuItemId: match.id,
    menuItemName: match.name,
    quantity,
    preparation,
    sides,
    modifiers,
    specialRequests,
    allergyNote,
    unitPrice: match.price,
    flags,
  };
}

export function validateDraftOrder(captured: CapturedItem[], menu: MenuItemForValidation[]): ValidatedDraft {
  const items = captured.map((c) => validateCapturedItem(c, menu));

  const reviewFlags = Array.from(new Set(items.flatMap((i) => i.flags)));
  const allergyFlag = reviewFlags.includes('ALLERGY_ESCALATION');

  let estimatedValue = 0;
  for (const item of items) {
    if (item.unitPrice !== null) estimatedValue += item.unitPrice * item.quantity;
  }
  estimatedValue = Math.round(estimatedValue * 100) / 100;

  // Version one is human-in-the-loop by design: EVERY draft goes to staff
  // review. Flags refine WHY, and drive alert severity, but never bypass review.
  const requiresHumanReview = true;
  const reviewReason = reviewFlags.length > 0 ? reviewFlags.join(', ') : 'STANDARD_REVIEW';
  const fullyPriced = items.length > 0 && items.every((i) => i.flags.length === 0);

  return {
    items,
    requiresHumanReview,
    reviewReason,
    reviewFlags,
    allergyFlag,
    estimatedValue,
    fullyPriced,
  };
}
