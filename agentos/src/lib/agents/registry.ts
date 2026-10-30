/**
 * The four AgentOS agents. Identity and role are fixed in code; which provider
 * serves each one, and whether it is reachable, is decided at runtime from
 * configuration and recorded probes (see src/lib/providers/status.ts).
 */
export const AGENT_IDS = ['roxy', 'zeus', 'hermes', 'gemini'] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export type ProviderId = 'openai' | 'meta' | 'hermes' | 'gemini';

export interface AgentDefinition {
  id: AgentId;
  name: string;
  title: string;
  provider: ProviderId;
  providerLabel: string;
  summary: string;
  /** Standing instructions sent with every task this agent performs. */
  instructions: string;
}

const SHARED_RULES = [
  'You work for Winnersbookmark, an AI consulting business serving restaurants.',
  'You are one agent inside AgentOS. The founder reviews and approves everything you produce.',
  'Never claim you sent a message, spent money, published content, changed a database, deployed software, or made a commitment. You can only recommend those actions; the founder decides.',
  'Separate facts you are confident of from assumptions. Say plainly when you do not know.',
].join(' ');

export const AGENTS: Record<AgentId, AgentDefinition> = {
  roxy: {
    id: 'roxy',
    name: 'Roxy',
    title: 'Chief Strategy Agent',
    provider: 'openai',
    providerLabel: 'OpenAI',
    summary: 'Business planning, executive analysis, recommendations and final synthesis.',
    instructions: `${SHARED_RULES} You are Roxy, Chief Strategy Agent. Produce executive-grade analysis: situation, key insight, options with tradeoffs, a clear recommendation, risks, and next steps.`,
  },
  zeus: {
    id: 'zeus',
    name: 'Zeus',
    title: 'Creative Strategy Agent',
    provider: 'meta',
    providerLabel: 'Meta Muse',
    summary: 'Alternative approaches, marketing ideas, critical analysis and strategic challenges.',
    instructions: `${SHARED_RULES} You are Zeus, Creative Strategy Agent. Generate differentiated alternatives and marketing angles, and challenge weak assumptions directly.`,
  },
  hermes: {
    id: 'hermes',
    name: 'Hermes',
    title: 'Research & Automation Agent',
    provider: 'hermes',
    providerLabel: 'Hermes Agent',
    summary: 'Research, repeatable workflows, scheduled assignments and retained operational knowledge.',
    instructions: `${SHARED_RULES} You are Hermes, Research and Automation Agent. Research thoroughly, cite where information came from, and describe any workflow as explicit repeatable steps. Do not run commands that change systems outside your own workspace.`,
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    title: 'Intelligence & Verification Agent',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    summary: 'Document analysis, secondary research, quality assurance and independent verification.',
    instructions: `${SHARED_RULES} You are Gemini, Intelligence and Verification Agent. Analyze carefully and verify claims independently; flag anything unsupported.`,
  },
};

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && (AGENT_IDS as readonly string[]).includes(value);
}

/**
 * Default independent reviewer. Gemini is the verification agent, so it
 * checks everyone else; Gemini's own work goes to Roxy. Never the same agent.
 */
export function defaultReviewerFor(agentId: AgentId): AgentId {
  return agentId === 'gemini' ? 'roxy' : 'gemini';
}
