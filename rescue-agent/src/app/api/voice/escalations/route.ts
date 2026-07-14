import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { guardVoiceTool } from '@/lib/voice/guard';
import { getActiveRestaurant } from '@/lib/voice/restaurant';
import { classifyEscalation } from '@/lib/voice/intents';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  callId: z.string().max(60).optional(),
  reason: z.string().max(120).optional(),
  utterance: z.string().max(1000).optional(),
  message: z.string().max(1000).optional(),
  targetRole: z.string().max(60).optional(),
  severity: z.enum(['NORMAL', 'HIGH', 'EMERGENCY']).optional(),
});

/**
 * Voice tool: log_escalation + send_staff_alert.
 *
 * Records a StaffAlert and, when the caller's utterance is supplied, runs the
 * deterministic safety gate so allergy/emergency language always drives the
 * correct severity even if the agent under-classified it. Returns the exact
 * hand-off script for the agent to read.
 */
export async function POST(request: Request) {
  const denied = guardVoiceTool(request);
  if (denied) return denied;

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: 'Invalid escalation.' }, { status: 400 });

  const restaurant = await getActiveRestaurant();
  if (!restaurant) return NextResponse.json({ error: 'No restaurant configured.' }, { status: 404 });

  // Deterministic safety gate may upgrade severity/target based on language.
  const gate = parsed.data.utterance ? classifyEscalation(parsed.data.utterance) : null;

  const reason = gate?.reason || parsed.data.reason || 'HUMAN_REQUEST';
  const severity = gate?.target?.severity || parsed.data.severity || 'NORMAL';
  const targetRole = gate?.target?.role || parsed.data.targetRole || 'HOST_STAND';
  const message = parsed.data.message || `Call escalation: ${reason}`;

  const alert = await prisma.staffAlert.create({
    data: {
      restaurantProfileId: restaurant.id,
      callId: parsed.data.callId ?? null,
      reason,
      severity,
      targetRole,
      message,
      status: 'PENDING',
    },
  });

  if (parsed.data.callId) {
    await Promise.all([
      prisma.callEvent
        .create({ data: { callId: parsed.data.callId, eventType: 'ESCALATION_TRIGGERED', metadata: { reason, severity, targetRole } } })
        .catch(() => {}),
      prisma.voiceCall
        .update({ where: { id: parsed.data.callId }, data: { transferred: true, transferTargetRole: targetRole, finalIntent: reason } })
        .catch(() => {}),
    ]);
  }

  return NextResponse.json(
    {
      alertId: alert.id,
      reason,
      severity,
      targetRole,
      agentScript: gate?.script ?? null,
    },
    { status: 201 },
  );
}
