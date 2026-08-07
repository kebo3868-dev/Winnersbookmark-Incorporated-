import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateApiKey, type StoredKey } from './apiKey';

/**
 * Persistence for tenant credentials and the audit trail.
 *
 * Every function is tenant-scoped in the same way as the rest of the front
 * desk store: the tenant is an argument, not something inferred, and it
 * appears in the WHERE clause even where the primary key alone would suffice.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export interface IssuedKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  /** Returned ONCE. Never persisted, never logged, never recoverable. */
  plaintext: string;
}

export async function createApiKey(
  tenantId: string,
  options: { name: string; scopes: string[]; expiresAt?: Date | null; createdBy?: string | null },
  db: Db = prisma,
): Promise<IssuedKey> {
  const generated = generateApiKey();
  const row = await db.fdApiKey.create({
    data: {
      tenantId,
      name: options.name,
      prefix: generated.prefix,
      keyHash: generated.keyHash,
      scopes: options.scopes,
      expiresAt: options.expiresAt ?? null,
      createdBy: options.createdBy ?? null,
    },
    select: { id: true, name: true, prefix: true, scopes: true, expiresAt: true },
  });
  return { ...row, plaintext: generated.plaintext };
}

/**
 * Resolve a presented key by its digest.
 *
 * NOT filtered by tenant: this answers "which tenant does this credential
 * belong to", and the caller then checks that against the tenant in the path
 * (see verifyStoredKey). Filtering here by the requested tenant would make a
 * wrong-tenant key indistinguishable from an unknown one in the audit log,
 * losing exactly the signal that matters for detecting a probing client.
 */
export async function findKeyByHash(keyHash: string, db: Db = prisma): Promise<StoredKey | null> {
  return db.fdApiKey.findUnique({
    where: { keyHash },
    select: { id: true, tenantId: true, keyHash: true, scopes: true, revokedAt: true, expiresAt: true },
  });
}

/** Best-effort last-used stamp. Never allowed to fail a request. */
export async function touchApiKey(keyId: string, db: Db = prisma): Promise<void> {
  try {
    await db.fdApiKey.update({ where: { id: keyId }, data: { lastUsedAt: new Date() } });
  } catch (error) {
    console.error('[frontdesk] could not record key usage', { keyId, error });
  }
}

export async function listApiKeys(tenantId: string, db: Db = prisma) {
  return db.fdApiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    // keyHash is deliberately absent: nothing outside verification needs it.
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

/** Revoke a key. Scoped by tenant so another tenant's key id cannot be revoked. */
export async function revokeApiKey(tenantId: string, keyId: string, db: Db = prisma): Promise<boolean> {
  const result = await db.fdApiKey.updateMany({
    where: { id: keyId, tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

// --- Audit log -------------------------------------------------------------

export interface AuditEntry {
  tenantId: string | null;
  event: string;
  actor: string;
  keyId?: string | null;
  outcome: 'ALLOWED' | 'DENIED' | 'CREATED' | 'REVOKED' | 'FAILED';
  detail?: string | null;
  requestId?: string | null;
}

/**
 * Append a security event.
 *
 * Auditing must never break the request it is describing, so a write failure
 * is logged to stderr and swallowed. It is also never given raw customer
 * message content or any credential material — `detail` is for short,
 * operator-readable reasons like "WRONG_TENANT".
 */
export async function recordAudit(entry: AuditEntry, db: Db = prisma): Promise<void> {
  try {
    await db.fdAuditLog.create({
      data: {
        tenantId: entry.tenantId,
        event: entry.event,
        actor: entry.actor,
        keyId: entry.keyId ?? null,
        outcome: entry.outcome,
        detail: entry.detail ? entry.detail.slice(0, 500) : null,
        requestId: entry.requestId ?? null,
      },
    });
  } catch (error) {
    console.error('[frontdesk] audit write failed', { event: entry.event, error });
  }
}

export async function listAuditLog(tenantId: string, take = 50, db: Db = prisma) {
  return db.fdAuditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}
