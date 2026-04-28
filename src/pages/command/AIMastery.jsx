import CommandLayout from '../../components/CommandLayout';
import { Card } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';
import { options } from '../../lib/commandCenterData';

export default function AIMastery() {
  const { state, update } = useCommandCenter();
  const setTrack = (id, patch) => update('aiTracks', state.aiTracks.map((m) => m.id === id ? { ...m, ...patch } : m));
  return <CommandLayout title="AI Mastery Tracker"><div className="grid md:grid-cols-2 gap-4">{state.aiTracks.map((m)=><Card key={m.id}><h3 className="font-semibold">{m.skill}</h3><input className="mt-2" placeholder="Learning checklist" value={m.checklist} onChange={(e)=>setTrack(m.id,{checklist:e.target.value})}/><input className="mt-2" placeholder="Practice project" value={m.project} onChange={(e)=>setTrack(m.id,{project:e.target.value})}/><input className="mt-2" placeholder="Proof asset" value={m.proofAsset} onChange={(e)=>setTrack(m.id,{proofAsset:e.target.value})}/><select className="mt-2" value={m.status} onChange={(e)=>setTrack(m.id,{status:e.target.value})}>{options.roadmapStatus.map((s)=><option key={s}>{s}</option>)}</select><textarea className="mt-2" placeholder="Notes" value={m.notes} onChange={(e)=>setTrack(m.id,{notes:e.target.value})}/></Card>)}</div></CommandLayout>;
}
