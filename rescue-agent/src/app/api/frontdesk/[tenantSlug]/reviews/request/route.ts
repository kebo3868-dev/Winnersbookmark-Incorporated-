import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { authorize, resolveActor } from '@/lib/frontdesk/auth/actor';
import { requestReviewForConversation } from '@/lib/frontdesk/reviews/store';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  conversationId: z.string().min(1).max(64),
});

/**
 * Ask one customer for a review (§XIII).
 *
 * DELIBERATELY AN EXPLICIT, AUTHENTICATED, ONE-CONVERSATION ACTION.
 *
 * The obvious alternative — fire a request automatically whenever a
 * conversation goes quiet — is how a restaurant discovers it has been texting
 * customers it never agreed to text. Review solicitation is the one outbound
 * message a customer did not ask for in any sense, so activating it needs a
 * person and a specific interaction, not a heuristic about when a chat ended.
 *
 * There is no bulk endpoint, and that is a feature: nothing here can send to a
 * list. Every gate lives in `requestReviewForConversation` and, beneath it, in
 * `checkReviewEligibility` and `queueMessage` — this route decides only who is
 * allowed to press the button.
 */
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

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

  const authz = authorize(await resolveActor(), tenant.id, 'leads:write');
  if (!authz.ok) return NextResponse.json({ error: 'NOT PERMITTED' }, { status: authz.status });

  // Refused before any database work when the restaurant has not opted in, so
  // a deployment that merely gains this endpoint cannot message anyone.
  if (!tenant.config.reviews?.enabled) {
    return NextResponse.json(
      { error: 'REVIEWS NOT ENABLED', detail: 'This restaurant has not enabled review requests.' },
      { status: 409 },
    );
  }

  const result = await requestReviewForConversation(tenant.id, parsed.data.conversationId, tenant.config);

  if (result.outcome === 'CONVERSATION_NOT_FOUND') {
    return NextResponse.json({ error: 'CONVERSATION NOT FOUND' }, { status: 404 });
  }

  // A suppression is a successful, recorded decision — not a server error. The
  // reason is returned so the operator can see WHY, which is the same
  // information the audit row carries.
  return NextResponse.json(result);
}
