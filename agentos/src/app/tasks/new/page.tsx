import { AGENT_IDS, AGENTS } from '@/lib/agents/registry';
import { requireOwnerPage } from '@/lib/auth/owner';
import { allAgentStatuses } from '@/lib/providers/status';
import { getStore } from '@/lib/store';
import { CONNECTION_LABEL } from '@/lib/ui/format';
import { Shell } from '@/components/Shell';
import { NewTaskForm } from '@/components/client/NewTaskForm';

export const dynamic = 'force-dynamic';

export default async function NewTaskPage() {
  await requireOwnerPage();
  const statuses = allAgentStatuses(await getStore().latestProbes());
  const agents = AGENT_IDS.map((id) => {
    const status = statuses.find((s) => s.agentId === id)!;
    return {
      id,
      name: AGENTS[id].name,
      title: AGENTS[id].title,
      status: status.state === 'not_configured' && status.simulated ? 'Not connected · will simulate' : CONNECTION_LABEL[status.state],
    };
  });
  return (
    <Shell>
      <h1 className="mb-4 text-xl font-bold">Mission Control · new task</h1>
      <div className="card"><NewTaskForm agents={agents} /></div>
    </Shell>
  );
}
