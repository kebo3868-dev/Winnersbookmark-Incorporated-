/**
 * LEVEROCK'S GREAT SEAFOOD — initial menu knowledge (seed).
 *
 * Every record here originates from menu PHOTOS observed by the project owner,
 * so its `verificationStatus` is PHOTO_OBSERVED — NOT confirmed. Before
 * production launch these must be raised to STAFF_CONFIRMED or
 * MANAGER_CONFIRMED by the restaurant team. Prices are restaurant-managed data:
 * the voice agent never invents a price and, on low confidence, offers to
 * confirm with the team instead of guessing.
 *
 * This module is the single source of truth used by BOTH the database seed
 * (prisma/seed.ts) and the pure-logic tests, so seed data and rules can never
 * drift apart.
 */

export type VerificationStatus =
  | 'UNVERIFIED'
  | 'PHOTO_OBSERVED'
  | 'STAFF_CONFIRMED'
  | 'MANAGER_CONFIRMED'
  | 'SYSTEM_CONFIRMED'
  | 'ARCHIVED';

export interface SeedMenuItem {
  name: string;
  slug: string;
  description?: string;
  /** Numeric price in dollars, or null when the menu shows a range / market price. */
  price: number | null;
  priceDisplay?: string;
  isMarketPrice?: boolean;
  mostPopular?: boolean;
  signatureItem?: boolean;
  requiresStaffConfirmation?: boolean;
  allergenEscalationRequired?: boolean;
  isAvailable?: boolean;
  availabilityNote?: string;
  prepOptions?: string[];
  sideOptions?: string[];
  modifierOptions?: string[];
  requiredSideCount?: number;
  verificationStatus?: VerificationStatus;
}

export interface SeedMenuCategory {
  name: string;
  slug: string;
  sortOrder: number;
  items: SeedMenuItem[];
}

/** Standard side choices observed on the menu; entrées ask for these. */
export const STANDARD_SIDES = [
  'Baked Potato',
  'French Fries',
  'Rice',
  'Coleslaw',
  'Caesar Salad',
  'House Salad',
  'Vegetable of the Day',
];

const PHOTO: VerificationStatus = 'PHOTO_OBSERVED';

export const LEVEROCKS_MENU: SeedMenuCategory[] = [
  {
    name: "Chef's Signature Dishes",
    slug: 'signature',
    sortOrder: 1,
    items: [
      {
        name: 'Broiled Sea Scallops',
        slug: 'broiled-sea-scallops',
        description:
          'Dry pack sea scallops, broiled in garlic butter with diced tomato, green onion, and topped with Italian bread crumbs.',
        price: 29.99,
        signatureItem: true,
        requiredSideCount: 2,
        sideOptions: STANDARD_SIDES,
        verificationStatus: PHOTO,
      },
      {
        name: 'Maryland Style Crab Cake',
        slug: 'maryland-crab-cake',
        description: 'Prepared with jumbo lump and backfin crabmeat. Lightly seasoned.',
        price: null,
        priceDisplay: 'One cake $19.50 · Two cakes $26.50',
        signatureItem: true,
        requiresStaffConfirmation: true,
        requiredSideCount: 2,
        sideOptions: STANDARD_SIDES,
        modifierOptions: ['One cake', 'Two cakes'],
        verificationStatus: PHOTO,
      },
      {
        name: 'Baltimore Platter',
        slug: 'baltimore-platter',
        description: 'A Maryland crab cake served with grilled sea scallops and jumbo shrimp.',
        price: 29.95,
        signatureItem: true,
        requiredSideCount: 2,
        sideOptions: STANDARD_SIDES,
        verificationStatus: PHOTO,
      },
      {
        name: 'Cod with Crab Butter',
        slug: 'cod-crab-butter',
        price: 26.5,
        requiredSideCount: 2,
        sideOptions: STANDARD_SIDES,
        verificationStatus: PHOTO,
      },
      {
        name: 'Cod Nantucket',
        slug: 'cod-nantucket',
        description: 'Italian bread crumbs, garlic butter, gulf shrimp, diced tomatoes, and fresh basil.',
        price: 25.95,
        requiredSideCount: 2,
        sideOptions: STANDARD_SIDES,
        verificationStatus: PHOTO,
      },
      {
        name: 'Blackened Swordfish and Scampi Style Shrimp',
        slug: 'blackened-swordfish-scampi-shrimp',
        price: 26.95,
        prepOptions: ['Blackened'],
        requiredSideCount: 2,
        sideOptions: STANDARD_SIDES,
        verificationStatus: PHOTO,
      },
      {
        name: 'Salmon del Rico',
        slug: 'salmon-del-rico',
        price: 23.95,
        prepOptions: ['Grilled', 'Blackened', 'Broiled'],
        requiredSideCount: 2,
        sideOptions: STANDARD_SIDES,
        verificationStatus: PHOTO,
      },
      {
        name: 'Snow Crab Dinner',
        slug: 'snow-crab-dinner',
        description: 'One full pound steamed and served with drawn butter. Includes 2 sides.',
        price: 29.99,
        signatureItem: true,
        requiredSideCount: 2,
        sideOptions: STANDARD_SIDES,
        verificationStatus: PHOTO,
      },
    ],
  },
  {
    name: 'Add to Any Entree',
    slug: 'add-ons',
    sortOrder: 2,
    items: [
      {
        name: 'Half Pound of Snow Crab Legs',
        slug: 'add-snow-crab-legs',
        price: 13.99,
        verificationStatus: PHOTO,
      },
      { name: 'Four Fried Shrimp', slug: 'add-fried-shrimp', price: 7.95, verificationStatus: PHOTO },
      {
        name: 'Three Bacon Wrapped Scallops',
        slug: 'add-bacon-wrapped-scallops',
        price: 9.95,
        verificationStatus: PHOTO,
      },
    ],
  },
  {
    name: 'Starters',
    slug: 'starters',
    sortOrder: 3,
    items: [
      { name: 'Lobster Bisque', slug: 'lobster-bisque', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Clam Chowder', slug: 'clam-chowder', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Raw Oysters', slug: 'raw-oysters', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Shrimp Cocktail', slug: 'shrimp-cocktail', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Tuna Sashimi', slug: 'tuna-sashimi', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Smoked Fish Spread', slug: 'smoked-fish-spread', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Dynamite Shrimp', slug: 'dynamite-shrimp', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Fried Crab Wontons', slug: 'fried-crab-wontons', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Oysters Rockefeller', slug: 'oysters-rockefeller', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Escargot', slug: 'escargot', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Calamari', slug: 'calamari', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Stuffed Mushroom Caps', slug: 'stuffed-mushroom-caps', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Onion Rings', slug: 'onion-rings', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Hushpuppy Basket', slug: 'hushpuppy-basket', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'P.E.I. Mussels', slug: 'pei-mussels', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
    ],
  },
  {
    name: 'Sandwiches and Burgers',
    slug: 'sandwiches-burgers',
    sortOrder: 4,
    items: [
      { name: 'Fresh Grouper Sandwich', slug: 'fresh-grouper-sandwich', price: null, requiresStaffConfirmation: true, availabilityNote: 'Fresh fish — confirm availability with the restaurant team.', verificationStatus: PHOTO },
      { name: 'Pasadena Grilled Chicken', slug: 'pasadena-grilled-chicken', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Outrageous Burger', slug: 'outrageous-burger', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
      { name: 'Bleu Cheese Crunch Burger', slug: 'bleu-cheese-crunch-burger', price: null, requiresStaffConfirmation: true, verificationStatus: PHOTO },
    ],
  },
  {
    name: 'Fresh Fish',
    slug: 'fresh-fish',
    sortOrder: 5,
    items: [
      {
        name: 'Fresh Catch of the Day',
        slug: 'fresh-catch',
        description:
          'Fresh fish selections change throughout the day. Availability and preparation must be confirmed by the restaurant team.',
        price: null,
        isMarketPrice: true,
        priceDisplay: 'Market price',
        requiresStaffConfirmation: true,
        isAvailable: false,
        availabilityNote: 'Fresh fish availability changes daily and must be confirmed live by staff.',
        verificationStatus: PHOTO,
      },
    ],
  },
];

/** The restaurant identity + policies used to seed the RestaurantProfile row. */
export const LEVEROCKS_PROFILE = {
  name: "Leverock's Great Seafood",
  slug: 'leverocks',
  greeting:
    "Thank you for calling Leverock's Great Seafood. I'm Leverock's virtual assistant. How may I help you today?",
  agentName: "Leverock's virtual assistant",
  timezone: 'America/New_York',
  // Observed on the Early Menu photo; unverified until staff confirm.
  earlyMenuNote:
    'An Early Menu is served approximately 11:30 AM to 5:30 PM. These hours are photo-observed and must be verified before the agent quotes them.',
  hoursNote: 'Business hours must be verified and entered by the restaurant team before the agent quotes them.',
  freshFishPolicy:
    'Fresh fish availability may change throughout the day. The agent gives general menu information but never guarantees fresh-fish availability; current availability is confirmed by the restaurant team.',
} as const;
