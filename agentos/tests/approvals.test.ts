import { describe, expect, it } from 'vitest';
import { assertApproved, authorizeAction, GATED_SIDE_EFFECTS } from '@/lib/approvals/policy';
import { MemoryStore } from '@/lib/store/memory';

async function setup() {
  const store = new MemoryStore();
  const task = await store.createTask({ title: 'Email campaign', objective: 'Draft a launch email to 40 restaurant owners.', agentId: 'zeus', reviewerAgentId: null, riskLevel: 'low' }, 'owner');
  return { store, task };
}

describe('approval policy', () => {
  it('gates all six side effects named in the directive', () => {
    expect([...GATED_SIDE_EFFECTS].sort()).toEqual(
      ['contractual_commitment', 'deploy_production', 'modify_production_database', 'publish_content', 'send_external_message', 'spend_money'],
    );
  });

  it('issues an ApprovedAction only for an approved record of the same task and action', async () => {
    const { store, task } = await setup();
    const approval = await store.createApproval({ taskId: task.id, actionType: 'send_external_message', summary: 'Send launch email' });
    expect(authorizeAction(approval, { taskId: task.id, actionType: 'send_external_message' })).toEqual({ ok: false, reason: 'Approval is pending' });

    const decided = await store.decideApproval(approval.id, 'approved', 'owner', null);
    expect(authorizeAction(decided, { taskId: task.id, actionType: 'spend_money' }).ok).toBe(false);
    expect(authorizeAction(decided, { taskId: 'other-task', actionType: 'send_external_message' }).ok).toBe(false);
    const granted = authorizeAction(decided, { taskId: task.id, actionType: 'send_external_message' });
    expect(granted.ok).toBe(true);
    if (granted.ok) {
      expect(() => assertApproved(granted.action, 'send_external_message')).not.toThrow();
      expect(() => assertApproved(granted.action, 'publish_content')).toThrow(/does not cover/);
    }
  });

  it('rejects a hand-built approval object', () => {
    const forged = { approvalId: 'x', taskId: 't', actionType: 'spend_money', approvedBy: 'owner', approvedAt: 'now' };
    expect(() => assertApproved(forged, 'spend_money')).toThrow(/Owner approval required/);
  });

  it('refuses a rejected approval', async () => {
    const { store, task } = await setup();
    const approval = await store.createApproval({ taskId: task.id, actionType: 'publish_content', summary: 'Publish post' });
    const rejected = await store.decideApproval(approval.id, 'rejected', 'owner', 'Not yet');
    expect(authorizeAction(rejected, { taskId: task.id, actionType: 'publish_content' })).toEqual({ ok: false, reason: 'Approval is rejected' });
  });
});

describe('recording decisions', () => {
  it('records who decided and when, updates the task, audits, and cannot be decided twice', async () => {
    const { store, task } = await setup();
    await store.claimTask(task.id, 'owner');
    await store.finishTask(task.id, 'awaiting_approval', null);
    const approval = await store.createApproval({ taskId: task.id, actionType: 'accept_result', summary: 'Zeus produced a result' });
    // A repeated request reuses the open approval rather than creating a second one.
    expect((await store.createApproval({ taskId: task.id, actionType: 'accept_result', summary: 'dup' })).id).toBe(approval.id);

    const decided = await store.decideApproval(approval.id, 'approved', 'owner', 'Good work');
    expect(decided).toMatchObject({ status: 'approved', decidedBy: 'owner', note: 'Good work' });
    expect(decided?.decidedAt).toBeTruthy();
    expect((await store.getTask(task.id))?.status).toBe('approved');
    expect(await store.decideApproval(approval.id, 'rejected', 'owner', null)).toBeNull();
    const actions = (await store.listAudit({ entityId: task.id })).map((e) => e.action);
    expect(actions).toContain('approval.approved');
  });
});
