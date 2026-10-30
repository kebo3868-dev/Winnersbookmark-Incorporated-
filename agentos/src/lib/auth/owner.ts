import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { authConfig, OWNER_ACTOR, SESSION_COOKIE, verifySession } from './session';

/**
 * OWNER AUTHORIZATION, CHECKED WHERE THE DATA IS READ.
 *
 * The proxy (src/proxy.ts) turns away unauthenticated requests first. Every
 * page and API route checks again here, so a matcher edit or framework
 * regression cannot expose the console (the lesson of Rescue Agent issue
 * #72). A structural test fails the build if a route skips this.
 */
export interface Owner {
  readonly actor: typeof OWNER_ACTOR;
}

const OWNER: Owner = Object.freeze({ actor: OWNER_ACTOR });

export async function requireOwnerPage(): Promise<Owner> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token)) redirect('/login');
  return OWNER;
}

export type OwnerRequestCheck = { ok: true; owner: Owner } | { ok: false; response: NextResponse };

function cookieFrom(request: Request): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=');
  }
  return undefined;
}

/**
 * State-changing requests must also come from this app's own pages: the
 * Origin header must name this host. With the SameSite=Strict cookie this
 * closes cross-site request forgery.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function requireOwnerRequest(request: Request, options: { mutating: boolean }): OwnerRequestCheck {
  if (!authConfig().ok) {
    return { ok: false, response: NextResponse.json({ error: 'ACCESS NOT CONFIGURED' }, { status: 503 }) };
  }
  if (!verifySession(cookieFrom(request))) {
    return { ok: false, response: NextResponse.json({ error: 'AUTHENTICATION REQUIRED' }, { status: 401 }) };
  }
  if (options.mutating && !isSameOrigin(request)) {
    return { ok: false, response: NextResponse.json({ error: 'CROSS-ORIGIN REQUEST REFUSED' }, { status: 403 }) };
  }
  return { ok: true, owner: OWNER };
}
