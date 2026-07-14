import { prisma } from '@/lib/db';
import type { MenuItemForValidation } from './draftOrder';

/**
 * Resolve the single active restaurant this deployment answers for. The voice
 * system is single-tenant per deployment (one phone line → one restaurant) but
 * the data model stays multi-tenant-ready.
 */
export async function getActiveRestaurant() {
  return prisma.restaurantProfile.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } });
}

/**
 * Load the verified, active menu for validation. Only ACTIVE items are
 * returned; ARCHIVED and inactive items never reach the agent.
 */
export async function getMenuForValidation(restaurantProfileId: string): Promise<MenuItemForValidation[]> {
  const items = await prisma.menuItem.findMany({
    where: { restaurantProfileId, isActive: true },
  });
  return items.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    price: m.price ? Number(m.price) : null,
    isAvailable: m.isAvailable,
    requiresStaffConfirmation: m.requiresStaffConfirmation,
    allergenEscalationRequired: m.allergenEscalationRequired,
    prepOptions: m.prepOptions,
    sideOptions: m.sideOptions,
    modifierOptions: m.modifierOptions,
    requiredSideCount: m.requiredSideCount,
  }));
}
