/**
 * Shapes a menu item for the voice agent, enforcing the pricing rule: a numeric
 * price is only surfaced as authoritative when the record is
 * staff/manager/system confirmed. Photo-observed prices are returned as
 * `priceDisplay` context but flagged unconfirmed, so the agent offers to
 * confirm with the team rather than quote an unverified number.
 */
const CONFIDENT: string[] = ['STAFF_CONFIRMED', 'MANAGER_CONFIRMED', 'SYSTEM_CONFIRMED'];

export interface RawMenuItem {
  name: string;
  slug: string;
  description: string | null;
  price: unknown;
  priceDisplay: string | null;
  isMarketPrice: boolean;
  isAvailable: boolean;
  availabilityNote: string | null;
  mostPopular: boolean;
  signatureItem: boolean;
  verificationStatus: string;
  category?: { name: string } | null;
}

export function toSafeMenuItem(item: RawMenuItem) {
  const priceConfirmed = CONFIDENT.includes(item.verificationStatus) && item.price != null;
  const numericPrice = item.price != null ? Number(item.price) : null;
  return {
    name: item.name,
    slug: item.slug,
    category: item.category?.name ?? null,
    description: item.description,
    mostPopular: item.mostPopular,
    signatureItem: item.signatureItem,
    isAvailable: item.isAvailable,
    availabilityNote: item.availabilityNote,
    isMarketPrice: item.isMarketPrice,
    // Only a confirmed price is authoritative.
    confirmedPrice: priceConfirmed ? numericPrice : null,
    priceDisplay: item.priceDisplay ?? (priceConfirmed ? `$${numericPrice!.toFixed(2)}` : null),
    priceConfirmed,
  };
}
