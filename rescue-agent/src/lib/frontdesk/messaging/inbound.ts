import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { runTurn } from '../engine';
import { normaliseNumber } from '../notify/provider';
import { enqueueEscalationNotifications } from '../notify/escalation';
import { getConversationHistory, openConversation, recordTurn, type TenantRecord } from '../store';
import { classifyInboundKeyword, keywordReply, statusAfterKeyword } from './consent';
import { queueMessage } from './send';
import { getConsent, setConsent } from './store';

/**
 * INBOUND SMS HANDLING
 *
 * Order of operations is the whole design:
 *
 *   1. Consent keywords FIRST. A STOP must take effect even if the engine
 *      would otherwise have produced a reply — processing the message first
 *      and honouring the opt-out afterwards would send one more message to
 *      someone who just asked to stop hearing from us.
 *   2. Record that we heard from them (establishes an implied basis, and
 *      resets the follow-up cap — they replied, so we are not talking into
 *      silence any more).
 *   3. Only then run the front desk engine and reply through the gated path.
 */

export interface InboundSms {
  fromNumber: string;
  body: string;
}

export type InboundResult =
  | { handled: 'OPT_OUT' | 'OPT_IN' | 'HELP'; reply: string | null }
  | { handled: 'CONVERSATION'; conversationId: string; reply: string; queued: boolean; blockedReason?: string }
  | { handled: 'IGNORED'; reason: string };

export async function handleInboundSms(
  tenant: TenantRecord,
  message: InboundSms,
  db: PrismaClient = prisma,
): Promise<InboundResult> {
  const fromNumber = normaliseNumber(message.fromNumber);
  if (!fromNumber) return { handled: 'IGNORED', reason: 'UNPARSEABLE_SENDER' };

  const body = message.body.trim();
  if (!body) return { handled: 'IGNORED', reason: 'EMPTY_BODY' };

  const keyword = classifyInboundKeyword(body, tenant.config);

  // --- 1. Consent keywords, before anything else ---------------------------
  if (keyword !== 'NONE') {
    const current = await getConsent(tenant.id, fromNumber, db);
    const next = statusAfterKeyword(keyword, current.status);
    await setConsent(tenant.id, fromNumber, next, `INBOUND_${keyword}`, { touchInbound: true }, db);

    const reply = keywordReply(keyword, tenant.config);
    if (reply) {
      // Carrier-mandated acknowledgement: the one message an opted-out number
      // should still receive, so it bypasses the consent gate. Rate limits
      // still apply — a loop of STOPs must not become a loop of replies.
      await queueMessage(
        {
          tenantId: tenant.id,
          config: tenant.config,
          toNumber: fromNumber,
          body: reply,
          purpose: 'CONVERSATION_REPLY',
          bypassConsent: true,
        },
        db,
      );
    }

    return {
      handled: keyword === 'STOP' ? 'OPT_OUT' : keyword === 'START' ? 'OPT_IN' : 'HELP',
      reply,
    };
  }

  // --- 2. Record the inbound contact ---------------------------------------
  const current = await getConsent(tenant.id, fromNumber, db);
  await setConsent(
    tenant.id,
    fromNumber,
    statusAfterKeyword('NONE', current.status),
    'INBOUND_MESSAGE',
    { touchInbound: true },
    db,
  );

  // An opted-out number that sends an ordinary message is answered on the
  // dashboard, not by SMS. We record what they said — refusing to read it
  // would lose a genuine enquiry — but we do not message them back.
  const suppressed = current.status === 'OPTED_OUT';

  // --- 3. Run the engine ---------------------------------------------------
  const conversation = await openConversation(
    tenant.id,
    { channel: 'SMS', externalRef: `sms:${fromNumber}`, demoMode: tenant.demoMode, customerPhone: fromNumber },
    db,
  );
  const history = await getConversationHistory(tenant.id, conversation.id, db);

  const turn = runTurn({
    config: tenant.config,
    message: body,
    history,
    now: new Date(),
    channel: 'SMS',
  });

  const recorded = await recordTurn(
    tenant.id,
    conversation.id,
    body,
    turn,
    { demoMode: tenant.demoMode, source: 'CHANNEL_SMS' },
    db,
  );

  // Escalations raised over SMS alert staff exactly as they do on the web.
  if (recorded.escalationIds.length > 0) {
    const drafts = turn.actions
      .filter((a) => a.type === 'ESCALATE')
      .map((a) => (a.type === 'ESCALATE' ? a.escalation : null))
      .filter((d): d is NonNullable<typeof d> => d !== null);
    try {
      await enqueueEscalationNotifications(
        tenant.id,
        tenant.config,
        recorded.escalationIds.map((escalationId, index) => ({
          escalationId,
          reason: drafts[index].reason,
          severity: drafts[index].severity,
          summary: drafts[index].summary,
          customerName: drafts[index].customerName,
          contact: drafts[index].contact ?? fromNumber,
          routeTo: drafts[index].routeTo,
        })),
        db,
      );
    } catch (error) {
      console.error('[frontdesk] inbound escalation alert failed', { tenantId: tenant.id, error });
    }
  }

  if (suppressed) {
    return {
      handled: 'CONVERSATION',
      conversationId: conversation.id,
      reply: turn.reply,
      queued: false,
      blockedReason: 'OPTED_OUT',
    };
  }

  const sent = await queueMessage(
    {
      tenantId: tenant.id,
      config: tenant.config,
      toNumber: fromNumber,
      body: turn.reply,
      purpose: 'CONVERSATION_REPLY',
      conversationId: conversation.id,
    },
    db,
  );

  return {
    handled: 'CONVERSATION',
    conversationId: conversation.id,
    reply: turn.reply,
    queued: sent.queued,
    blockedReason: sent.queued ? undefined : sent.reason,
  };
}
