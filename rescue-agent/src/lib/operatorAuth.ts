import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';
import { checkBasicAuth, resolveAuthMode } from '@/lib/auth';

/**
 * OPERATOR AUTHORIZATION, CHECKED WHERE THE DATA IS READ.
 *
 * The operator area — the Command Center, every audit, the client report, the
 * internal Sales Brief, leads and their APIs — was protected by one thing: the
 * app-wide middleware (`src/middleware.ts`). Nothing behind it checked again,
 * so a matcher edit, a new exemption or a framework regression would have
 * served confidential sales intelligence with no second wall (issue #72).
 *
 * Every operator page and route now calls this first. It recognises exactly
 * what the middleware recognises — the operator credential, or local
 * development with no credentials configured — and nothing else: a Front Desk
 * restaurant session is never an operator, and neither is a tenant API key.
 * The middleware stays in place as the outer layer.
 *
 * A successful check yields an `OperatorAuthorization`. It cannot be built
 * outside this module, and the loaders for the most sensitive data — the
 * client report and the Sales Brief — require one, so reaching that data
 * without passing this check does not compile.
 */
export class OperatorAuthorization {
  private constructor(readonly via: 'OPERATOR_CREDENTIAL' | 'LOCAL_DEVELOPMENT') {}

  /** @internal Issued only by `checkOperator`. */
  static issue(via: OperatorAuthorization['via']): OperatorAuthorization {
    return new OperatorAuthorization(via);
  }
}

export type OperatorCheck =
  | { ok: true; operator: OperatorAuthorization }
  | { ok: false; status: 401 | 503 };

/**
 * Decide whether a request carries the operator credential. Pure: the caller
 * supplies the Authorization header, so routes, pages and tests share it.
 */
export function checkOperator(
  authorizationHeader: string | null,
  env: Record<string, string | undefined> = process.env,
): OperatorCheck {
  const mode = resolveAuthMode({
    BASIC_AUTH_USER: env.BASIC_AUTH_USER,
    BASIC_AUTH_PASSWORD: env.BASIC_AUTH_PASSWORD,
    NODE_ENV: env.NODE_ENV,
  });
  // Local development with no credentials: the middleware is open too, and
  // this check must not be the thing that blocks offline work.
  if (mode === 'open') return { ok: true, operator: OperatorAuthorization.issue('LOCAL_DEVELOPMENT') };
  // Production without credentials fails closed, as the middleware does.
  if (mode === 'misconfigured') return { ok: false, status: 503 };
  const ok = checkBasicAuth(authorizationHeader, env.BASIC_AUTH_USER as string, env.BASIC_AUTH_PASSWORD as string);
  return ok ? { ok: true, operator: OperatorAuthorization.issue('OPERATOR_CREDENTIAL') } : { ok: false, status: 401 };
}

/**
 * For operator pages (server components). Refuses with a 404 rather than a
 * challenge: a page reached without the credential means the middleware was
 * bypassed, and the page should reveal nothing — not even that it exists.
 */
export async function requireOperatorPage(): Promise<OperatorAuthorization> {
  const check = checkOperator((await headers()).get('authorization'));
  if (!check.ok) notFound();
  return check.operator;
}

export type OperatorRequestCheck =
  | { ok: true; operator: OperatorAuthorization }
  | { ok: false; response: NextResponse };

/** For operator API routes. Reads the request's own header. */
export function requireOperatorRequest(request: Request): OperatorRequestCheck {
  const check = checkOperator(request.headers.get('authorization'));
  if (check.ok) return check;
  if (check.status === 503) {
    return { ok: false, response: NextResponse.json({ error: 'ACCESS NOT CONFIGURED' }, { status: 503 }) };
  }
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'AUTHENTICATION REQUIRED' },
      { status: 401, headers: { 'www-authenticate': 'Basic realm="Winnersbookmark Rescue Agent", charset="UTF-8"' } },
    ),
  };
}

/** Runtime check for loaders, so a cast cannot stand in for a real authorization. */
export function assertOperator(operator: unknown): asserts operator is OperatorAuthorization {
  if (!(operator instanceof OperatorAuthorization)) throw new Error('Operator authorization required');
}
