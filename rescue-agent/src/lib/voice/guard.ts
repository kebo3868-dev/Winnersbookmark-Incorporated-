import { NextResponse } from 'next/server';
import { checkVoiceToolAuth, resolveVoiceToolAuthMode } from './config';

/**
 * Guard for the voice tool API endpoints. Returns a NextResponse to short-
 * circuit with when the request is not allowed, or null when it may proceed.
 * Fail-closed in production if VOICE_TOOL_TOKEN is unset (these endpoints
 * create records and trigger staff alerts).
 */
export function guardVoiceTool(request: Request): NextResponse | null {
  const mode = resolveVoiceToolAuthMode({
    VOICE_TOOL_TOKEN: process.env.VOICE_TOOL_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (mode === 'open') return null;

  if (mode === 'misconfigured') {
    return NextResponse.json(
      { error: 'VOICE_TOOL_TOKEN not configured; voice endpoints are disabled.' },
      { status: 503 },
    );
  }

  const ok = checkVoiceToolAuth(request.headers.get('authorization'), process.env.VOICE_TOOL_TOKEN as string);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}
