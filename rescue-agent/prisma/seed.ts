/**
 * Seed for LEVEROCK'S AI CALL & ORDER RESCUE SYSTEM.
 *
 * Idempotent: safe to re-run. All menu data is seeded as PHOTO_OBSERVED — it is
 * NOT production-ready until the restaurant team raises records to
 * STAFF_CONFIRMED / MANAGER_CONFIRMED. Staff contact phone numbers are left
 * blank on purpose (never hard-code personal numbers); configure them in the
 * database or via the staff console before going live.
 */
import { PrismaClient } from '@prisma/client';
import { LEVEROCKS_MENU, LEVEROCKS_PROFILE } from '../src/lib/voice/menuData';

const prisma = new PrismaClient();

const STAFF_ROLES = [
  'HOST_STAND',
  'MANAGER_ON_DUTY',
  'GENERAL_MANAGER',
  'TO_GO_STATION',
  'EVENTS_CONTACT',
  'EMERGENCY_ESCALATION',
];

async function main() {
  const restaurant = await prisma.restaurantProfile.upsert({
    where: { slug: LEVEROCKS_PROFILE.slug },
    update: {
      name: LEVEROCKS_PROFILE.name,
      greeting: LEVEROCKS_PROFILE.greeting,
      agentName: LEVEROCKS_PROFILE.agentName,
      timezone: LEVEROCKS_PROFILE.timezone,
      earlyMenuNote: LEVEROCKS_PROFILE.earlyMenuNote,
      hoursNote: LEVEROCKS_PROFILE.hoursNote,
      freshFishPolicy: LEVEROCKS_PROFILE.freshFishPolicy,
    },
    create: {
      name: LEVEROCKS_PROFILE.name,
      slug: LEVEROCKS_PROFILE.slug,
      greeting: LEVEROCKS_PROFILE.greeting,
      agentName: LEVEROCKS_PROFILE.agentName,
      timezone: LEVEROCKS_PROFILE.timezone,
      earlyMenuNote: LEVEROCKS_PROFILE.earlyMenuNote,
      hoursNote: LEVEROCKS_PROFILE.hoursNote,
      freshFishPolicy: LEVEROCKS_PROFILE.freshFishPolicy,
    },
  });

  for (const role of STAFF_ROLES) {
    await prisma.staffContact.upsert({
      where: { restaurantProfileId_role: { restaurantProfileId: restaurant.id, role } },
      update: {},
      create: { restaurantProfileId: restaurant.id, role, active: false },
    });
  }

  let categoryCount = 0;
  let itemCount = 0;
  for (const cat of LEVEROCKS_MENU) {
    const category = await prisma.menuCategory.upsert({
      where: { restaurantProfileId_slug: { restaurantProfileId: restaurant.id, slug: cat.slug } },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: { restaurantProfileId: restaurant.id, name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder },
    });
    categoryCount++;

    for (const item of cat.items) {
      await prisma.menuItem.upsert({
        where: { restaurantProfileId_slug: { restaurantProfileId: restaurant.id, slug: item.slug } },
        update: {
          categoryId: category.id,
          name: item.name,
          description: item.description ?? null,
          price: item.price ?? null,
          priceDisplay: item.priceDisplay ?? null,
          isMarketPrice: item.isMarketPrice ?? false,
          isAvailable: item.isAvailable ?? true,
          availabilityNote: item.availabilityNote ?? null,
          mostPopular: item.mostPopular ?? false,
          signatureItem: item.signatureItem ?? false,
          requiresStaffConfirmation: item.requiresStaffConfirmation ?? false,
          allergenEscalationRequired: item.allergenEscalationRequired ?? false,
          prepOptions: item.prepOptions ?? [],
          sideOptions: item.sideOptions ?? [],
          modifierOptions: item.modifierOptions ?? [],
          requiredSideCount: item.requiredSideCount ?? 0,
          verificationStatus: item.verificationStatus ?? 'PHOTO_OBSERVED',
          sourceType: 'MENU_PHOTO',
        },
        create: {
          restaurantProfileId: restaurant.id,
          categoryId: category.id,
          name: item.name,
          slug: item.slug,
          description: item.description ?? null,
          price: item.price ?? null,
          priceDisplay: item.priceDisplay ?? null,
          isMarketPrice: item.isMarketPrice ?? false,
          isAvailable: item.isAvailable ?? true,
          availabilityNote: item.availabilityNote ?? null,
          mostPopular: item.mostPopular ?? false,
          signatureItem: item.signatureItem ?? false,
          requiresStaffConfirmation: item.requiresStaffConfirmation ?? false,
          allergenEscalationRequired: item.allergenEscalationRequired ?? false,
          prepOptions: item.prepOptions ?? [],
          sideOptions: item.sideOptions ?? [],
          modifierOptions: item.modifierOptions ?? [],
          requiredSideCount: item.requiredSideCount ?? 0,
          verificationStatus: item.verificationStatus ?? 'PHOTO_OBSERVED',
          sourceType: 'MENU_PHOTO',
        },
      });
      itemCount++;
    }
  }

  console.log(
    `Seeded ${restaurant.name}: ${categoryCount} categories, ${itemCount} menu items, ${STAFF_ROLES.length} staff roles.`,
  );
  console.log('All menu data is PHOTO_OBSERVED — verify with the restaurant team before production launch.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
