import { NextResponse } from 'next/server';

/** Liveness only. Reveals nothing about configuration or data. */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok' });
}
