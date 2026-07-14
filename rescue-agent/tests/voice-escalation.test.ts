import { describe, expect, it } from 'vitest';
import {
  classifyEscalation,
  escalationForIntent,
  shouldEscalateAfterClarification,
} from '@/lib/voice/intents';
import { resolveVoiceToolAuthMode, checkVoiceToolAuth } from '@/lib/voice/config';

describe('classifyEscalation (deterministic safety gate)', () => {
  it('escalates emergencies to EMERGENCY_ESCALATION with an emergency script', () => {
    const d = classifyEscalation('someone is choking please call an ambulance');
    expect(d.escalate).toBe(true);
    expect(d.reason).toBe('EMERGENCY');
    expect(d.target?.role).toBe('EMERGENCY_ESCALATION');
    expect(d.target?.severity).toBe('EMERGENCY');
    expect(d.script).toMatch(/9 1 1/);
  });

  it('escalates any allergy mention to the manager and never guarantees safety', () => {
    const d = classifyEscalation('do you have anything for a severe shellfish allergy?');
    expect(d.escalate).toBe(true);
    expect(d.reason).toBe('ALLERGY_OR_DIETARY_CONCERN');
    expect(d.target?.severity).toBe('HIGH');
    expect(d.script).toMatch(/connect you with the restaurant team/i);
  });

  it('prioritizes emergency over an allergy mention in the same utterance', () => {
    const d = classifyEscalation('my friend has a peanut allergy and is not breathing');
    expect(d.reason).toBe('EMERGENCY');
  });

  it('routes explicit human requests to the host stand', () => {
    const d = classifyEscalation('can I just talk to a person');
    expect(d.reason).toBe('HUMAN_REQUEST');
    expect(d.target?.role).toBe('HOST_STAND');
  });

  it('does not escalate an ordinary menu question', () => {
    expect(classifyEscalation('what time do you close tonight?').escalate).toBe(false);
  });
});

describe('escalationForIntent', () => {
  it('escalates refund requests to the manager', () => {
    expect(escalationForIntent('REFUND_REQUEST').target?.role).toBe('MANAGER_ON_DUTY');
  });
  it('routes private events to the events contact', () => {
    expect(escalationForIntent('PRIVATE_EVENT').target?.role).toBe('EVENTS_CONTACT');
  });
  it('does not escalate a plain menu question', () => {
    expect(escalationForIntent('MENU_QUESTION').escalate).toBe(false);
  });
});

describe('shouldEscalateAfterClarification', () => {
  it('escalates after two failed clarification attempts', () => {
    expect(shouldEscalateAfterClarification(1)).toBe(false);
    expect(shouldEscalateAfterClarification(2)).toBe(true);
  });
});

describe('voice tool auth', () => {
  it('is open in dev without a token but fails closed in production', () => {
    expect(resolveVoiceToolAuthMode({ NODE_ENV: 'development' })).toBe('open');
    expect(resolveVoiceToolAuthMode({ NODE_ENV: 'production' })).toBe('misconfigured');
  });
  it('requires a token of sufficient length', () => {
    expect(resolveVoiceToolAuthMode({ VOICE_TOOL_TOKEN: 'short', NODE_ENV: 'production' })).toBe('misconfigured');
    expect(resolveVoiceToolAuthMode({ VOICE_TOOL_TOKEN: 'a-sufficiently-long-token', NODE_ENV: 'production' })).toBe('required');
  });
  it('accepts a correct bearer token and rejects a wrong one', () => {
    const token = 'a-sufficiently-long-token';
    expect(checkVoiceToolAuth(`Bearer ${token}`, token)).toBe(true);
    expect(checkVoiceToolAuth('Bearer wrong-token-value-here', token)).toBe(false);
    expect(checkVoiceToolAuth(null, token)).toBe(false);
  });
});
