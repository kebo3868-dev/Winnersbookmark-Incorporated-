import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { createAudit, runAudit } from '@/lib/audit/orchestrator';

const bodySchema = z.object({
  websiteUrl: z.string().min(4).max(2000),
  restaurantName: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  knownConcern: z.string().max(2000).optional(),
});

// Very small in-memory rate limit (per server instance) to protect the collector.
const recentRequests: number[] = [];
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const now = Date.now();
  while (recentRequests.length > 0 && recentRequests[0] < now - RATE_WINDOW_MS) recentRequests.shift();
  if (recentRequests.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many audit requests. Please wait a minute.' }, { status: 429 });
  }
  recentRequests.push(now);

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'INVALID WEBSITE URL' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID WEBSITE URL' }, { status: 400 });
  }

  try {
    const result = await createAudit(parsed.data);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    // Run the pipeline after the response is sent; progress is persisted and polled.
    after(async () => {
      try {
        await runAudit(result.auditId);
      } catch (error) {
        console.error('Audit pipeline crashed', error);
      }
    });
    return NextResponse.json({ auditId: result.auditId }, { status: 201 });
  } catch (error) {
    console.error('createAudit failed', error);
    return NextResponse.json({ error: 'AUDIT COULD NOT START' }, { status: 500 });
  }
}
