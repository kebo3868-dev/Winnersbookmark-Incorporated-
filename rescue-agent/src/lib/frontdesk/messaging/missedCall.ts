import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { normaliseNumber } from '../notify/provider';
import { recordFailure } from '../notify/store';
import { openConversation, type TenantRecord } from '../store';
import { queueMessage } from './send';
import { getConsent, setConsent } from './store';

/**
 * MISSED-CALL RECOVERY (§VII)
 *
 * The revenue feature: a call nobody answered is a customer who was about to
 * book, order or ask something, and who will simply call the next restaurant.
 * A prompt text turns that into a conversation.
 *
 * The restraint that matters: this is ONE message. The customer then replies
 * or does not, and if they do not, the follow-up cap in the send gate stops us
 * chasing them — "do not repeatedly message customers who do not engage".
 *
 * A missed call is treated as the customer initiating contact, which is what
 * establishes the basis for replying to them. An explicit prior STOP still
 * wins: the send gate refuses, and the refusal is filed for the operator.
 */

export interface MissedCall {
  fromNumber: string;
  /** Provider call identifier, used for de-duplication upstream. */
  callId: string;
  occurredAt?: Date;
}

export type MissedCallResult =
  | { recovered: true; conversationId: string; notificationId: string }
  | { recovered: false; reason: string; detail: string; conversationId?: string };

/** Default copy, used when the restaurant has not supplied its own. */
export function buildRecoveryMessage(tenant: TenantRecord): string {
  const configured = tenant.config.messaging.missedCallTemplate?.trim();
  if (configured) return configured;

  const name = tenant.config.brandVoice.restaurantDisplayName ?? tenant.config.restaurantName;
  // Matches the spec's example wording, plus the opt-out notice every
  // automated first contact should carry.
  return `Hi, this is ${name}. Sorry we missed your call — how can we help? Reply STOP to opt out.`;
}

export async function handleMissedCall(
  tenant: TenantRecord,
  call: MissedCall,
  db: PrismaClient = prisma,
): Promise<MissedCallResult> {
  const fromNumber = normaliseNumber(call.fromNumber);
  if (!fromNumber) {
    return { recovered: false, reason: 'UNPARSEABLE_CALLER', detail: 'Caller number could not be parsed' };
  }

  if (!tenant.config.messaging.missedCallRecoveryEnabled) {
    // Not a failure — a restaurant may deliberately not want this. Recorded so
    // an operator can see why no recovery text went out if they expected one.
    await recordFailure(
      {
        tenantId: tenant.id,
        category: 'FAILED_NOTIFICATION',
        operation: 'missedCall.disabled',
        detail: 'Missed call received but recovery is switched off for this restaurant',
        lastError: 'RECOVERY_DISABLED',
      },
      db,
    );
    return { recovered: false, reason: 'RECOVERY_DISABLED', detail: 'Missed-call recovery is switched off' };
  }

  // A call to the restaurant is contact from the customer, which establishes a
  // basis for replying. Never upgrade a number that previously opted out —
  // only an explicit START does that.
  //
  // `touchInbound` is deliberately FALSE. That field is the baseline for the
  // follow-up cap, and it must only move when the customer answers one of our
  // messages. A caller who rings five times and never replies to the recovery
  // text has not engaged with it — resetting the counter on each call would
  // send them five texts, which is exactly the pestering the cap exists to
  // prevent (§VII).
  const existing = await getConsent(tenant.id, fromNumber, db);
  if (existing.status !== 'OPTED_OUT') {
    await setConsent(tenant.id, fromNumber, 'IMPLIED', 'MISSED_CALL', { touchInbound: false }, db);
  }

  // The conversation exists whether or not the text goes out, so the missed
  // call itself is visible on the dashboard as a recovery opportunity.
  const conversation = await openConversation(
    tenant.id,
    {
      channel: 'VOICE',
      externalRef: `call:${call.callId}`,
      demoMode: tenant.demoMode,
      customerPhone: fromNumber,
    },
    db,
  );

  const result = await queueMessage(
    {
      tenantId: tenant.id,
      config: tenant.config,
      toNumber: fromNumber,
      body: buildRecoveryMessage(tenant),
      purpose: 'MISSED_CALL_RECOVERY',
      conversationId: conversation.id,
    },
    db,
  );

  if (!result.queued) {
    return { recovered: false, reason: result.reason, detail: result.detail, conversationId: conversation.id };
  }

  return { recovered: true, conversationId: conversation.id, notificationId: result.notificationId };
}
