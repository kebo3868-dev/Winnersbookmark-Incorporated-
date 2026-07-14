import { describe, expect, it } from 'vitest';
import { validateDraftOrder, type MenuItemForValidation } from '@/lib/voice/draftOrder';

const menu: MenuItemForValidation[] = [
  {
    id: 'itm_swordfish',
    name: 'Blackened Swordfish and Scampi Style Shrimp',
    slug: 'blackened-swordfish-scampi-shrimp',
    price: 26.95,
    isAvailable: true,
    requiresStaffConfirmation: false,
    allergenEscalationRequired: false,
    prepOptions: ['Blackened'],
    sideOptions: ['Baked Potato', 'Caesar Salad', 'French Fries'],
    modifierOptions: [],
    requiredSideCount: 2,
  },
  {
    id: 'itm_crabcake',
    name: 'Maryland Style Crab Cake',
    slug: 'maryland-crab-cake',
    price: null, // ranged / market price on the menu
    isAvailable: true,
    requiresStaffConfirmation: true,
    allergenEscalationRequired: false,
    prepOptions: [],
    sideOptions: ['Baked Potato', 'Caesar Salad'],
    modifierOptions: ['One cake', 'Two cakes'],
    requiredSideCount: 2,
  },
  {
    id: 'itm_freshfish',
    name: 'Fresh Catch of the Day',
    slug: 'fresh-catch',
    price: null,
    isAvailable: false,
    requiresStaffConfirmation: true,
    allergenEscalationRequired: false,
    prepOptions: [],
    sideOptions: [],
    modifierOptions: [],
    requiredSideCount: 0,
  },
];

describe('validateDraftOrder', () => {
  it('prices a clean, complete order and always requires human review', () => {
    const result = validateDraftOrder(
      [
        {
          menuItemName: 'Blackened Swordfish and Scampi Style Shrimp',
          quantity: 2,
          preparation: 'Blackened',
          sides: ['Baked Potato', 'Caesar Salad'],
        },
      ],
      menu,
    );
    expect(result.items[0].flags).toEqual([]);
    expect(result.items[0].menuItemId).toBe('itm_swordfish');
    expect(result.estimatedValue).toBeCloseTo(53.9, 2);
    expect(result.fullyPriced).toBe(true);
    // Version one is human-in-the-loop: review is required even for a clean order.
    expect(result.requiresHumanReview).toBe(true);
  });

  it('flags an unknown menu item and does not invent a price', () => {
    const result = validateDraftOrder([{ menuItemName: 'Lobster Thermidor Deluxe' }], menu);
    expect(result.items[0].flags).toContain('UNKNOWN_MENU_ITEM');
    expect(result.items[0].menuItemId).toBeNull();
    expect(result.items[0].unitPrice).toBeNull();
    expect(result.estimatedValue).toBe(0);
  });

  it('flags missing required sides', () => {
    const result = validateDraftOrder(
      [{ menuItemName: 'Blackened Swordfish and Scampi Style Shrimp', preparation: 'Blackened', sides: ['Baked Potato'] }],
      menu,
    );
    expect(result.items[0].flags).toContain('MISSING_REQUIRED_OPTION');
  });

  it('flags an invalid side and preparation', () => {
    const result = validateDraftOrder(
      [
        {
          menuItemName: 'Blackened Swordfish and Scampi Style Shrimp',
          preparation: 'Deep Fried',
          sides: ['Baked Potato', 'Lobster Mac'],
        },
      ],
      menu,
    );
    expect(result.items[0].flags).toContain('INVALID_PREPARATION');
    expect(result.items[0].flags).toContain('INVALID_SIDE');
  });

  it('flags price-unavailable and staff-confirmation items without inventing a total', () => {
    const result = validateDraftOrder(
      [{ menuItemName: 'Maryland Style Crab Cake', modifiers: ['Two cakes'], sides: ['Baked Potato', 'Caesar Salad'] }],
      menu,
    );
    expect(result.items[0].flags).toContain('PRICE_UNAVAILABLE');
    expect(result.items[0].flags).toContain('REQUIRES_STAFF_CONFIRMATION');
    expect(result.estimatedValue).toBe(0);
  });

  it('flags an unavailable fresh-fish item', () => {
    const result = validateDraftOrder([{ menuItemName: 'Fresh Catch of the Day' }], menu);
    expect(result.items[0].flags).toContain('ITEM_UNAVAILABLE');
  });

  it('raises the allergy flag from an allergy note', () => {
    const result = validateDraftOrder(
      [
        {
          menuItemName: 'Blackened Swordfish and Scampi Style Shrimp',
          sides: ['Baked Potato', 'Caesar Salad'],
          preparation: 'Blackened',
          allergyNote: 'severe shellfish allergy',
        },
      ],
      menu,
    );
    expect(result.allergyFlag).toBe(true);
    expect(result.reviewFlags).toContain('ALLERGY_ESCALATION');
  });
});
