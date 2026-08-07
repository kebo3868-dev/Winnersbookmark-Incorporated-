import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { TenantConfig } from '../config/schema';
import { queueMessage } from '../messaging/send';
import { maskNumber, normaliseNumber } from './provider';

/**
 * ESCALATION ROTA VERIFICATION
 *
 * An escalation rota is a list of phone numbers somebody typed. Until a
 * message has gone to one and a delivery receipt has come back, it is a
 * guess — and the moment it matters is the moment nobody wants to discover
 * the digits were transposed.
 *
 * So verification is evidence-based and deliberately hard to fake:
 *
 *   - The test alert goes through `queueMessage`, the same gated path as a
 *     real alert. If consent, rate limits or configuration would block a real
 *     alert to this contact, the test is blocked too and the rota does not
 *     pass. A test that took a shortcut would prove nothing about the path
 *     the real alert uses.
 *   - VERIFIED is reached ONLY from a provider delivery receipt. An accepted
 *     send means the vendor took it, not that a handset rang.
 *   - The number is part of the record's identity, so editing a contact's
 *     number drops the proof rather than inheriting it.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export const VERIFICATION_MESSAGE =
  'Winners Bookmark front desk test alert. You are on the escalation rota for this restaurant. ' +
  'No action needed — reply STOP to opt out of these alerts.';

export type VerificationRequest =
  | { ok: true; verificationId: string; notificationId: string; masked: string }
  | { ok: false; reason: string; detail: string };

/**
 * Send a test alert to one escalation contact and open a verification record.
 *
 * `critical: false` deliberately. A test must not be allowed to bypass the
 * spend limits — that exemption exists for a food-safety incident, and a
 * verification run that could burn through an unbounded budget is a footgun
 * pointed at the restaurant's bill.
 */
export async function requestContactVerification(
  tenantId: string,
  config: TenantConfig,
  contactKey: string,
  requestedBy: string | null,
  db: PrismaClient = prisma,
): Promise<VerificationRequest> {
  const contact = config.escalationContacts.find((c) => c.key === contactKey);
  if (!contact) {
    return { ok: false, reason: 'NO_SUCH_CONTACT', detail: `No escalation contact with key "${contactKey}"` };
  }
  if (!contact.phone) {
    return { ok: false, reason: 'NO_PHONE', detail: `Contact "${contactKey}" has no phone number configured` };
  }

  const phone = normaliseNumber(contact.phone);
  if (!phone) {
    return { ok: false, reason: 'INVALID_PHONE', detail: `Contact "${contactKey}" has an unusable phone number` };
  }

  const result = await queueMessage(
    {
      tenantId,
      config,
      toNumber: phone,
      body: VERIFICATION_MESSAGE,
      purpose: 'ESCALATION_ALERT',
    },
    db,
  );

  if (!result.queued) {
    // The refusal is already in the failure queue courtesy of queueMessage.
    // Recorded here as FAILED too, so the readiness gate sees a tested-and-
    // failed contact rather than an untested one.
    await db.fdContactVerification.upsert({
      where: { tenantId_contactKey_phone: { tenantId, contactKey, phone } },
      create: {
        tenantId,
        contactKey,
        phone,
        status: 'FAILED',
        requestedBy,
        failureReason: `${result.reason}: ${result.detail}`.slice(0, 300),
      },
      update: {
        status: 'FAILED',
        requestedBy,
        notificationId: null,
        verifiedAt: null,
        requestedAt: new Date(),
        failureReason: `${result.reason}: ${result.detail}`.slice(0, 300),
      },
    });
    return { ok: false, reason: result.reason, detail: result.detail };
  }

  const record = await db.fdContactVerification.upsert({
    where: { tenantId_contactKey_phone: { tenantId, contactKey, phone } },
    create: {
      tenantId,
      contactKey,
      phone,
      notificationId: result.notificationId,
      status: 'SENT',
      requestedBy,
    },
    // A re-test clears the previous outcome. Keeping an old VERIFIED while a
    // new test is in flight would let a stale pass mask a fresh failure.
    update: {
      notificationId: result.notificationId,
      status: 'SENT',
      requestedBy,
      requestedAt: new Date(),
      verifiedAt: null,
      failureReason: null,
    },
  });

  return {
    ok: true,
    verificationId: record.id,
    notificationId: result.notificationId,
    masked: maskNumber(phone),
  };
}

/**
 * Apply a delivery outcome to any verification waiting on that notification.
 *
 * Called from the delivery-receipt path. Scoped by tenant as well as
 * notification id so a receipt can never resolve another restaurant's
 * verification, even if an id leaked.
 */
export async function applyVerificationOutcome(
  notificationId: string,
  tenantId: string,
  outcome: 'DELIVERED' | 'UNDELIVERED',
  options: { at: Date; errorMessage?: string | null } = { at: new Date() },
  db: Db = prisma,
): Promise<void> {
  await db.fdContactVerification.updateMany({
    where: { notificationId, tenantId, status: 'SENT' },
    data:
      outcome === 'DELIVERED'
        ? { status: 'VERIFIED', verifiedAt: options.at, failureReason: null }
        : {
            status: 'FAILED',
            verifiedAt: null,
            failureReason: (options.errorMessage ?? 'Provider reported the test alert as undelivered').slice(0, 300),
          },
  });
}

export interface RotaStatus {
  /** Rota order from config, or every contact with a phone when unset. */
  order: string[];
  verifiedKeys: string[];
  /** Rota contacts that have been tested and failed, with the reason. */
  failed: Array<{ contactKey: string; reason: string | null }>;
  pendingKeys: string[];
  untestedKeys: string[];
}

/**
 * Current verification state of a tenant's rota.
 *
 * Verification rows are matched on BOTH key and number: a contact whose phone
 * has changed since it was verified counts as untested, because the proof was
 * about the old number.
 */
export async function getRotaStatus(
  tenantId: string,
  config: TenantConfig,
  db: Db = prisma,
): Promise<RotaStatus> {
  const order =
    config.pilot.escalationRota.length > 0
      ? config.pilot.escalationRota
      : config.escalationContacts.filter((c) => c.phone).map((c) => c.key);

  const rows = await db.fdContactVerification.findMany({
    where: { tenantId },
    select: { contactKey: true, phone: true, status: true, failureReason: true },
  });

  const currentPhone = new Map(
    config.escalationContacts
      .filter((c) => c.phone)
      .map((c) => [c.key, normaliseNumber(c.phone as string)] as const),
  );

  const verifiedKeys: string[] = [];
  const pendingKeys: string[] = [];
  const failed: Array<{ contactKey: string; reason: string | null }> = [];

  for (const key of order) {
    const phone = currentPhone.get(key) ?? null;
    const row = phone ? rows.find((r) => r.contactKey === key && r.phone === phone) : undefined;
    if (!row) continue;
    if (row.status === 'VERIFIED') verifiedKeys.push(key);
    else if (row.status === 'SENT' || row.status === 'PENDING') pendingKeys.push(key);
    else failed.push({ contactKey: key, reason: row.failureReason });
  }

  const accountedFor = new Set([...verifiedKeys, ...pendingKeys, ...failed.map((f) => f.contactKey)]);
  const untestedKeys = order.filter((key) => !accountedFor.has(key));

  return { order, verifiedKeys, failed, pendingKeys, untestedKeys };
}
