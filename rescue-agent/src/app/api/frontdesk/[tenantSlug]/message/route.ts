import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { SCOPES } from '@/lib/frontdesk/auth/apiKey';
import { authFailureMessage, authenticateTenantRequest } from '@/lib/frontdesk/auth/authenticate';
import { findKeyByHash, recordAudit, touchApiKey } from '@/lib/frontdesk/auth/store';
import { retractAlertClaim, runTurn } from '@/lib/frontdesk/engine';
import { enqueueEscalationNotifications } from '@/lib/frontdesk/notify/escalation';
import {
  amendAssistantReply,
  getConversationHistory,
  getTenantBySlug,
  openConversation,
  recordTurn,
} from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * The front desk conversation endpoint.
 *
 * One customer message in, one front-desk reply out, everything persisted
 * against the tenant named in the path. The tenant is resolved from the URL
 * and used for every subsequent query, so a caller cannot reach another
 * restaurant's conversation by supplying its conversation id — the history
 * lookup is scoped by tenant and simply returns empty (§XIX).
 *
 * AUTHENTICATION (Phase 2): the caller must present either a tenant API key
 * bound to the restaurant in the path, or the WBI admin credential. A key
 * belonging to a different restaurant is rejected even though it is otherwise
 * valid — that is the isolation boundary.
 *
 * Whether this endpoint is reachable WITHOUT the app-wide Basic Auth is a
 * separate switch (FRONTDESK_PUBLIC_ENDPOINT_ENABLED, default off). Building
 * the authentication and exposing the endpoint are deliberately two decisions.
 */

const bodySchema = z.object({
  message: z.string().min(1, 'message is required').max(2000),
  conversationId: z.string().min(1).max(64).optional(),
  channel: z.enum(['WEB', 'SMS', 'VOICE']).default('WEB'),
  /** Provider-side id used to de-duplicate redelivered webhooks. */
  externalRef: z.string().min(1).max(128).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

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
  const { message, conversationId, channel, externalRef } = parsed.data;

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });
  }

  // --- Authentication ------------------------------------------------------
  const requestId = request.headers.get('x-request-id')?.slice(0, 64) ?? randomUUID();
  const auth = await authenticateTenantRequest({
    authorizationHeader: request.headers.get('authorization'),
    expectedTenantId: tenant.id,
    requiredScope: SCOPES.MESSAGE_WRITE,
    lookupKey: (keyHash) => findKeyByHash(keyHash),
  });

  if (!auth.ok) {
    // Denials are always audited. A run of WRONG_TENANT entries is the signal
    // that one client is probing another restaurant's endpoint.
    await recordAudit({
      tenantId: tenant.id,
      event: 'MESSAGE_AUTH',
      actor: 'UNKNOWN',
      outcome: 'DENIED',
      detail: auth.failure.reason,
      requestId,
    });
    return NextResponse.json(
      { error: authFailureMessage(auth.failure) },
      { status: auth.failure.status },
    );
  }

  if (tenant.status === 'SUSPENDED') {
    return NextResponse.json({ error: 'RESTAURANT IS NOT ACTIVE' }, { status: 409 });
  }

  if (auth.actor.kind === 'TENANT_KEY') {
    await touchApiKey(auth.actor.keyId);
  }

  try {
    // An existing conversation is only reused when it belongs to this tenant.
    let activeConversationId = conversationId ?? null;
    if (activeConversationId) {
      const owned = await prisma.fdConversation.findFirst({
        where: { id: activeConversationId, tenantId: tenant.id },
        select: { id: true },
      });
      if (!owned) activeConversationId = null;
    }

    if (!activeConversationId) {
      const conversation = await openConversation(tenant.id, {
        channel,
        externalRef: externalRef ?? null,
        demoMode: tenant.demoMode,
      });
      activeConversationId = conversation.id;
    }

    const history = await getConversationHistory(tenant.id, activeConversationId);

    const turn = runTurn({
      config: tenant.config,
      message,
      history,
      now: new Date(),
      channel,
    });

    const recorded = await recordTurn(
      tenant.id,
      activeConversationId,
      message,
      turn,
      { demoMode: tenant.demoMode, source: `CHANNEL_${channel}` },
      prisma,
    );

    // The reply as it will be sent. Escalation dispatch below may retract a
    // claim it makes, which is why this is not read straight off `turn`.
    let reply = turn.reply;

    // Escalations become actual alerts. Queued AFTER the escalation rows are
    // committed, so a messaging problem can never lose the escalation itself,
    // and wrapped so it can never fail the customer's request either — the
    // customer has already been answered by this point.
    if (recorded.escalationIds.length > 0) {
      const drafts = turn.actions
        .filter((action) => action.type === 'ESCALATE')
        .map((action) => (action.type === 'ESCALATE' ? action.escalation : null))
        .filter((draft): draft is NonNullable<typeof draft> => draft !== null);

      try {
        const dispatch = await enqueueEscalationNotifications(
          tenant.id,
          tenant.config,
          recorded.escalationIds.map((escalationId, index) => ({
            escalationId,
            reason: drafts[index].reason,
            severity: drafts[index].severity,
            summary: drafts[index].summary,
            customerName: drafts[index].customerName,
            contact: drafts[index].contact,
            routeTo: drafts[index].routeTo,
          })),
          prisma,
        );

        // TRUTH CORRECTION. The reply may have promised the team was flagged
        // as urgent, on the strength of a configured contact. Whether that
        // contact is actually reachable is runtime state the pure engine
        // cannot see — they may have texted STOP since. If nothing was
        // queued, the promise is retracted before the customer reads it.
        if (dispatch.queued === 0) {
          reply = retractAlertClaim(reply, tenant.config);
        }
      } catch (error) {
        console.error('[frontdesk] escalation notification enqueue failed', { tenantSlug, error });
        // The dispatch attempt itself failed, so nothing was alerted either.
        reply = retractAlertClaim(reply, tenant.config);
      }

      // Keep the transcript equal to what was actually sent. Written outside
      // the try/catch above so a correction is never lost to a dispatch error,
      // and guarded so the common case does no extra write.
      if (reply !== turn.reply) {
        await amendAssistantReply(tenant.id, recorded.assistantMessageId, reply);
      }
    }

    // The message body is never audited — only that a turn happened, by whom.
    await recordAudit({
      tenantId: tenant.id,
      event: 'MESSAGE_HANDLED',
      actor: auth.actor.kind,
      keyId: auth.actor.kind === 'TENANT_KEY' ? auth.actor.keyId : null,
      outcome: 'ALLOWED',
      detail: `intent=${turn.intent} source=${turn.answerSource}`,
      requestId,
    });

    return NextResponse.json({
      conversationId: activeConversationId,
      reply,
      intent: turn.intent,
      secondaryIntents: turn.secondaryIntents,
      answerSource: turn.answerSource,
      needsHuman: turn.needsHuman,
      // Never "confirmed" unless a booking integration said so (§V).
      bookingState: turn.bookingState,
      leadIds: recorded.leadIds,
      escalationIds: recorded.escalationIds,
      demoMode: tenant.demoMode,
    });
  } catch (error) {
    // Never fail silently (§XVI). The customer-facing message stays neutral;
    // the detail goes to the server log, without the message body.
    console.error('[frontdesk] turn failed', { tenantSlug, channel, error });
    return NextResponse.json({ error: 'FRONT DESK COULD NOT PROCESS THIS MESSAGE' }, { status: 500 });
  }
}
