import CommandLayout from '../../components/CommandLayout';
import { Card, Field, TextArea } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';

export default function Relationships() {
  const { state, update } = useCommandCenter();
  const r = state.relationships;
  const set = (k,v)=>update('relationships',{...r,[k]:v});
  return <CommandLayout title="Relationship & Network Tracker"><Card><TextArea label="People to reconnect with" value={r.reconnect} onChange={(e)=>set('reconnect',e.target.value)}/><TextArea label="New contacts" value={r.newContacts} onChange={(e)=>set('newContacts',e.target.value)}/><TextArea label="Mentors" value={r.mentors} onChange={(e)=>set('mentors',e.target.value)}/><TextArea label="Potential collaborators" value={r.collaborators} onChange={(e)=>set('collaborators',e.target.value)}/><TextArea label="Dating / social goals" value={r.socialGoals} onChange={(e)=>set('socialGoals',e.target.value)}/><TextArea label="Community contribution goals" value={r.communityGoals} onChange={(e)=>set('communityGoals',e.target.value)}/><Field label="Monthly actions completed" type="number" value={r.monthlyActions} onChange={(e)=>set('monthlyActions',Number(e.target.value)||0)}/><p className="text-sm text-wb-muted">Target: 2 new meaningful contacts, 1 reconnection, 1 networking action, 1 community action.</p></Card></CommandLayout>;
}
