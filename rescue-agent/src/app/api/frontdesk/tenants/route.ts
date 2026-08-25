import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authorizePlatform, resolveActor } from '@/lib/frontdesk/auth/actor';
import { recordAudit } from '@/lib/frontdesk/auth/store';
import { parseTenantConfig } from '@/lib/frontdesk/config/schema';

export const dynamic = 'force-dynamic';

/**
 * CREATE A REAL RESTAURANT
 *
 * Until now the only code that created a tenant was `seedDemoTenants`, which
 * writes two fixtures. There was no supported way to onboard an actual client,
 * so the first pilot would have been a hand-written row in production.
 *
 * That matters more than the missing convenience. A direct insert bypasses
 * `parseTenantConfig`, and a config that fails validation makes the restaurant
 * load as a 404 with only a server log to explain why — the tenant exists, the
 * dashboard says it does not, and nothing points at the malformed field. This
 * route validates first and refuses with the offending path named.
 *
 * `demoMode` is not a parameter. Demo restaurants come from the demo seeder;
 * anything created here is real, and a route that could mint a demo tenant on
 * a production deployment is a foot-gun with no use case.
 */
const bodySchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase words separated by hyphens'),
  name: z.string().min(1).max(200),
  /** The full tenant configuration. Validated against the schema below. */
  config: z.unknown(),
});

export async function POST(request: NextRequest) {
  const authz = authorizePlatform(await resolveActor());
  if (!authz.ok) return NextResponse.json({ error: 'NOT PERMITTED' }, { status: authz.status });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID REQUEST BODY' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Validate BEFORE writing. The whole point of this route.
  const config = parseTenantConfig(parsed.data.config);
  if (!config.ok) {
    return NextResponse.json({ error: 'INVALID CONFIGURATION', detail: config.error }, { status: 400 });
  }

  const existing = await prisma.fdTenant.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: 'SLUG ALREADY IN USE' }, { status: 409 });
  }

  const tenant = await prisma.fdTenant.create({
    data: {
      slug: parsed.data.slug,
      name: parsed.data.name,
      status: 'ONBOARDING',
      // Never a demo. See the note above.
      demoMode: false,
      config: config.config as never,
    },
    select: { id: true, slug: true, name: true, status: true },
  });

  await recordAudit({
    tenantId: tenant.id,
    event: 'TENANT_CREATED',
    actor: authz.actor.kind,
    outcome: 'ALLOWED',
    detail: `slug=${tenant.slug}`,
  });

  return NextResponse.json(tenant, { status: 201 });
}
