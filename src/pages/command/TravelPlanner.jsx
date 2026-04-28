import CommandLayout from '../../components/CommandLayout';
import { Card } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';
import { options } from '../../lib/commandCenterData';

export default function TravelPlanner() {
  const { state, update } = useCommandCenter();
  const setTravel = (next)=>update('travel', next);
  const add = ()=>setTravel([{id:crypto.randomUUID(),destination:'',estimatedCost:0,safetyNotes:'',purpose:'',targetDate:'',savingsProgress:0,status:'Dreaming'}, ...state.travel]);
  const edit = (id, patch)=>setTravel(state.travel.map((t)=>t.id===id?{...t,...patch}:t));

  return <CommandLayout title="Travel & Experience Planner"><Card className="mb-3"><button className="btn-primary" onClick={add}>Add Destination</button></Card>{state.travel.map((t)=><Card key={t.id} className="mb-3"><input value={t.destination} onChange={(e)=>edit(t.id,{destination:e.target.value})} placeholder="Destination"/><div className="grid grid-cols-2 gap-2 mt-2"><input type="number" value={t.estimatedCost} onChange={(e)=>edit(t.id,{estimatedCost:Number(e.target.value)||0})} placeholder="Estimated cost"/><input type="date" value={t.targetDate} onChange={(e)=>edit(t.id,{targetDate:e.target.value})}/></div><input className="mt-2" type="number" value={t.savingsProgress} onChange={(e)=>edit(t.id,{savingsProgress:Number(e.target.value)||0})} placeholder="Savings progress"/><select className="mt-2" value={t.status} onChange={(e)=>edit(t.id,{status:e.target.value})}>{options.travelStatus.map((s)=><option key={s}>{s}</option>)}</select><textarea className="mt-2" value={t.safetyNotes} onChange={(e)=>edit(t.id,{safetyNotes:e.target.value})} placeholder="Safety notes"/><textarea className="mt-2" value={t.purpose} onChange={(e)=>edit(t.id,{purpose:e.target.value})} placeholder="Travel purpose"/></Card>)}</CommandLayout>;
}
