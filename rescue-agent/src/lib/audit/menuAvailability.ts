/**
 * Reads the MENU_AVAILABILITY record — the one conclusion evidence.ts draws
 * from every linked menu destination judged on its own.
 *
 * The phone finding and the MENU journey stage both act on that conclusion.
 * Each used to re-derive it from the individual records, and they disagreed:
 * an untested menu link was "not verified" in the evidence and "linked and
 * reachable" on the journey map. Reading it in one place keeps them aligned.
 */
export type MenuAvailabilityState = 'VERIFIED' | 'FAILED' | 'UNVERIFIED';

export function readMenuAvailability(fact: string): { state: MenuAvailabilityState; spareFailed: boolean } {
  const state: MenuAvailabilityState = /^A working menu was verified/i.test(fact)
    ? 'VERIFIED'
    : /^No readable menu was found/i.test(fact)
      ? 'FAILED'
      : 'UNVERIFIED';
  // A failure beside a working or unverified destination: disclosed, never decisive.
  return { state, spareFailed: state !== 'FAILED' && /failed when tested/i.test(fact) };
}
