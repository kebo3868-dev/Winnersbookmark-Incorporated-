import CommandLayout from '../../components/CommandLayout';
import { Card } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';
import { options } from '../../lib/commandCenterData';

export default function Roadmap() {
  const { state, update } = useCommandCenter();
  const setItem = (id, patch) => update('roadmap', state.roadmap.map((m) => m.id === id ? { ...m, ...patch } : m));
  return <CommandLayout title="12-Month Roadmap"><div className="grid md:grid-cols-2 gap-4">{state.roadmap.map((m) => <Card key={m.id}><h3 className="font-semibold mb-2">Month {m.month}: {m.objective}</h3><label className="label">Status</label><select value={m.status} onChange={(e)=>setItem(m.id,{status:e.target.value,complete:e.target.value==='Complete'})}>{options.roadmapStatus.map((s)=><option key={s}>{s}</option>)}</select><input className="mt-2" placeholder="Learning tasks" value={m.learningTasks} onChange={(e)=>setItem(m.id,{learningTasks:e.target.value})} /><input className="mt-2" placeholder="Practice project" value={m.practiceProject} onChange={(e)=>setItem(m.id,{practiceProject:e.target.value})} /><textarea className="mt-2" placeholder="Notes" value={m.notes} onChange={(e)=>setItem(m.id,{notes:e.target.value})} /></Card>)}</div></CommandLayout>;
}
