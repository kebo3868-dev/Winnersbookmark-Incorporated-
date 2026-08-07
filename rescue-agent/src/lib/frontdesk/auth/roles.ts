/**
 * ROLES AND PERMISSIONS (§XXVI — least privilege)
 *
 * Two things are separated here on purpose:
 *
 *   WHAT a role may do   → the permission matrix below.
 *   WHICH restaurant     → the actor's tenantId, checked separately.
 *
 * Conflating them is how multi-tenant systems leak: a "manager" permission
 * check that forgets to ask "manager of WHICH restaurant" passes for every
 * restaurant. Every authorization decision in this codebase answers both
 * questions, and the tests assert that holding a role at one restaurant grants
 * nothing at another.
 */

export const ROLES = [
  'WBI_ADMIN',
  'RESTAURANT_OWNER',
  'RESTAURANT_MANAGER',
  'RESTAURANT_STAFF',
  'READ_ONLY',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  /** See a restaurant's dashboard, leads, conversations. */
  'tenant:read',
  /** Move leads through the pipeline, resolve failures. */
  'leads:write',
  /** Issue and revoke that restaurant's API keys. */
  'keys:manage',
  /** Change a restaurant's configuration. */
  'config:write',
  /** Create/refresh/remove demo data. */
  'demo:manage',
  /** Platform-wide: create restaurants, view every tenant, drain the queue. */
  'platform:admin',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * The matrix. Deliberately explicit rather than hierarchical — "owner implies
 * manager implies staff" reads well and hides exactly the mistake that matters
 * (a role silently gaining a permission when the hierarchy is edited).
 */
const MATRIX: Record<Role, readonly Permission[]> = {
  WBI_ADMIN: ['tenant:read', 'leads:write', 'keys:manage', 'config:write', 'demo:manage', 'platform:admin'],
  RESTAURANT_OWNER: ['tenant:read', 'leads:write', 'keys:manage', 'config:write'],
  RESTAURANT_MANAGER: ['tenant:read', 'leads:write'],
  RESTAURANT_STAFF: ['tenant:read', 'leads:write'],
  READ_ONLY: ['tenant:read'],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

/** Roles that are bound to exactly one restaurant. */
export function isTenantRole(role: Role): boolean {
  return role !== 'WBI_ADMIN';
}

/**
 * Whether an actor may act on a specific restaurant.
 *
 * This is the isolation check. A restaurant role is only ever satisfied by an
 * exact tenant match — there is no wildcard, no "parent tenant", and no
 * inheritance. WBI_ADMIN is the single documented exception, and it is why
 * `platform:admin` exists as a separate permission rather than being implied.
 */
export function mayActOnTenant(
  actor: { role: Role; tenantId: string | null },
  targetTenantId: string,
): boolean {
  if (actor.role === 'WBI_ADMIN') return true;
  if (!actor.tenantId) return false; // a restaurant role with no tenant is malformed
  return actor.tenantId === targetTenantId;
}

export function parseRole(value: unknown): Role | null {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

/**
 * Validate the invariant the whole model rests on: exactly WBI_ADMIN has no
 * tenant, and every other role has one. A row violating this is refused rather
 * than being given the benefit of the doubt.
 */
export function isWellFormedActor(actor: { role: Role; tenantId: string | null }): boolean {
  return actor.role === 'WBI_ADMIN' ? actor.tenantId === null : actor.tenantId !== null;
}
