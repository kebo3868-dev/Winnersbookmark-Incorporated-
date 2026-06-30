import { useState, useEffect } from 'react';

// Entitlement seam for the subscription experience.
//
// Membership gating reads from this single source of truth so the paywall logic
// is real: when `isMember` becomes true, gated articles render in full. For the
// front-end prototype, membership is stored in a local flag. WIRE THIS UP when
// you connect checkout: after Stripe/Gumroad confirms a subscription (via your
// backend + a session/JWT or their entitlement API), resolve `isMember` from
// that verified state instead of localStorage.
//
// Preview the member experience anytime by calling grantMembership() (e.g. from
// the console) or setting localStorage 'wb_member' = 'true'.

const KEY = 'wb_member';
const EVENT = 'wb:entitlement';

export function isMemberNow() {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function grantMembership() {
  try {
    localStorage.setItem(KEY, 'true');
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable — no-op */
  }
}

export function revokeMembership() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable — no-op */
  }
}

// Reactive entitlement state — updates on cross-tab storage changes and on the
// in-tab `wb:entitlement` event fired by grant/revoke.
export function useEntitlement() {
  const [isMember, setIsMember] = useState(isMemberNow);

  useEffect(() => {
    const sync = () => setIsMember(isMemberNow());
    window.addEventListener('storage', sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);

  return { isMember };
}
