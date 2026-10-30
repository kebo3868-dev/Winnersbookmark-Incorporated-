import type { Approval } from '@/lib/store/types';

/**
 * HUMAN APPROVAL POLICY.
 *
 * AgentOS agents only produce text. Anything that acts on the world is one of
 * these action types, and each requires an explicit, recorded owner approval
 * first. `accept_result` is the founder accepting an agent's output as the
 * task's answer; the other six are the side effects the directive gates.
 *
 * Code that performs a gated action must take an `ApprovedAction`. One can
 * only be obtained from `authorizeAction`, which checks a stored approval is
 * approved, for that action type, on that task — so a side effect without an
 * approval does not compile, and a forged object fails the runtime check.
 * No side-effecting executor exists in this build; the type is in place so
 * the first one cannot be written without it.
 */
export const ACTION_TYPES = [
  'accept_result',
  'send_external_message',
  'spend_money',
  'publish_content',
  'modify_production_database',
  'deploy_production',
  'contractual_commitment',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const GATED_SIDE_EFFECTS: readonly ActionType[] = ACTION_TYPES.filter((type) => type !== 'accept_result');

export const ACTION_LABELS: Record<ActionType, string> = {
  accept_result: 'Accept result',
  send_external_message: 'Send an external message',
  spend_money: 'Spend money',
  publish_content: 'Publish content',
  modify_production_database: 'Modify a production database',
  deploy_production: 'Deploy a production change',
  contractual_commitment: 'Create a contractual commitment',
};

export function isActionType(value: unknown): value is ActionType {
  return typeof value === 'string' && (ACTION_TYPES as readonly string[]).includes(value);
}

const ISSUED = new WeakSet<object>();

export interface ApprovedAction {
  readonly approvalId: string;
  readonly taskId: string;
  readonly actionType: ActionType;
  readonly approvedBy: string;
  readonly approvedAt: string;
}

export type AuthorizeResult = { ok: true; action: ApprovedAction } | { ok: false; reason: string };

export function authorizeAction(approval: Approval | null, expected: { taskId: string; actionType: ActionType }): AuthorizeResult {
  if (!approval) return { ok: false, reason: 'No approval record' };
  if (approval.taskId !== expected.taskId) return { ok: false, reason: 'Approval belongs to a different task' };
  if (approval.actionType !== expected.actionType) return { ok: false, reason: `Approval covers ${approval.actionType}, not ${expected.actionType}` };
  if (approval.status !== 'approved') return { ok: false, reason: `Approval is ${approval.status}` };
  if (!approval.decidedBy || !approval.decidedAt) return { ok: false, reason: 'Approval is not attributed' };
  const action: ApprovedAction = Object.freeze({
    approvalId: approval.id,
    taskId: approval.taskId,
    actionType: approval.actionType,
    approvedBy: approval.decidedBy,
    approvedAt: approval.decidedAt,
  });
  ISSUED.add(action);
  return { ok: true, action };
}

/** Executors call this first, so a hand-built object cannot stand in for an approval. */
export function assertApproved(action: unknown, actionType: ActionType): asserts action is ApprovedAction {
  if (typeof action !== 'object' || action === null || !ISSUED.has(action)) throw new Error('Owner approval required');
  if ((action as ApprovedAction).actionType !== actionType) throw new Error(`Approval does not cover ${actionType}`);
}
