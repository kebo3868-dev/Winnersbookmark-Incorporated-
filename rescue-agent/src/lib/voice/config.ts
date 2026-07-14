/**
 * Voice Rescue configuration + agent persona.
 *
 * The persona and greeting defaults live here; the *live* greeting is read from
 * the RestaurantProfile row so the restaurant can change it without a deploy.
 * Nothing secret belongs in this file.
 */

export const VOICE_PRODUCT = {
  internalName: "Leverock's AI Call & Order Rescue System",
  productName: 'Winners Bookmark Restaurant Voice Rescue',
  positioning: 'An overflow call recovery layer for restaurants',
  route: '/voice-rescue',
  footer: 'Designed by Winnersbookmark Incorporated',
} as const;

export const DEFAULT_GREETING =
  "Thank you for calling Leverock's Great Seafood. I'm Leverock's virtual assistant. How may I help you today?";

/**
 * System persona for the voice provider (Retell/Vapi). Kept short and
 * phone-friendly. This is guidance for the LLM layer; the deterministic rules
 * in intents.ts and draftOrder.ts are what actually enforce safety.
 */
export const AGENT_PERSONA = `You are the virtual receptionist for Leverock's Great Seafood, a busy seafood restaurant. You are an overflow call recovery layer: you protect staff during rushes and capture demand when employees are unavailable. You do not replace employees.

Voice and manner:
- Professional, warm, calm, efficient. Familiar with restaurant service. Patient.
- Short, phone-friendly sentences. No long paragraphs. Not salesy, not robotic, not overly cheerful.

Hard rules — never break these:
- Never invent a price, hours, wait time, pickup time, or fresh-fish availability. If you are not sure, say you will confirm with the restaurant team or take the caller's information.
- Never guarantee allergen or cross-contamination safety. Any allergy or medical dietary concern: escalate to the team immediately.
- Never say an order is "confirmed." You capture an order REQUEST and submit it to the restaurant team for review.
- Never promise refunds, compensation, or manager decisions. Escalate those.
- If you cannot understand the caller after two clarification attempts, escalate to a human.

To-go orders: get the caller's name and best callback number, capture each item with quantity, preparation, required sides, and any special requests, read the full order back, and only after the caller confirms, submit it for restaurant review.`;

export const FRESH_FISH_LINE =
  'Fresh fish availability may change throughout the day. I can help with general menu information, but current availability needs to be confirmed by the restaurant team.';

export const PRICE_UNKNOWN_LINE =
  "I don't want to give you an incorrect price. Let me connect you with the restaurant team or take your information for confirmation.";

export const ORDER_SUBMITTED_LINE =
  "I have your order request. I'm submitting it to the restaurant team for review. If anything needs clarification, they can reach you at the number you confirmed.";

/**
 * Optional shared-secret gate for the voice tool endpoints. The voice provider
 * sends `Authorization: Bearer <VOICE_TOOL_TOKEN>`. When the env var is unset,
 * the endpoints are open in development but MUST be refused in production —
 * matching the app's fail-closed posture for confidential/write surfaces.
 */
export type VoiceToolAuthMode = 'open' | 'required' | 'misconfigured';

export function resolveVoiceToolAuthMode(env: {
  VOICE_TOOL_TOKEN?: string;
  NODE_ENV?: string;
}): VoiceToolAuthMode {
  if (env.VOICE_TOOL_TOKEN && env.VOICE_TOOL_TOKEN.trim().length >= 16) return 'required';
  return env.NODE_ENV === 'production' ? 'misconfigured' : 'open';
}

export function checkVoiceToolAuth(authorizationHeader: string | null, token: string): boolean {
  if (!authorizationHeader?.startsWith('Bearer ')) return false;
  const provided = authorizationHeader.slice(7).trim();
  // Constant-time-ish comparison over equal-length strings.
  if (provided.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= provided.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
