import { useState } from 'react';
import CommandLayout from '../../components/CommandLayout';
import { Card, TextArea } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';

const empty = { completed:'', avoided:'', energy:'', drained:'', biggestWin:'', correction:'', nextMission:'' };

export default function WeeklyReview(){
  const { state, update } = useCommandCenter();
  const [form, setForm] = useState(empty);
  const on = (k,v)=>setForm({...form,[k]:v});
  const submit=()=>{ update('weeklyReviews', [{...form, date:new Date().toISOString()}, ...state.weeklyReviews]); setForm(empty); };
  return <CommandLayout title="Weekly Review"><Card><TextArea label="1. What did I complete?" value={form.completed} onChange={(e)=>on('completed',e.target.value)}/><TextArea label="2. What did I avoid?" value={form.avoided} onChange={(e)=>on('avoided',e.target.value)}/><TextArea label="3. What gave me energy?" value={form.energy} onChange={(e)=>on('energy',e.target.value)}/><TextArea label="4. What drained me?" value={form.drained} onChange={(e)=>on('drained',e.target.value)}/><TextArea label="5. Biggest win?" value={form.biggestWin} onChange={(e)=>on('biggestWin',e.target.value)}/><TextArea label="6. What needs correction next week?" value={form.correction} onChange={(e)=>on('correction',e.target.value)}/><TextArea label="7. Number one mission next week?" value={form.nextMission} onChange={(e)=>on('nextMission',e.target.value)}/><button className="btn-primary" onClick={submit}>Save Weekly Review</button></Card><Card className="mt-4"><h3 className="font-semibold mb-2">Review History</h3>{state.weeklyReviews.map((r,i)=><div key={i} className="border-b border-wb-border py-2 text-sm"><p className="text-wb-muted">{new Date(r.date).toLocaleDateString()}</p><p>{r.biggestWin || 'No win logged'}</p></div>)}</Card></CommandLayout>
}
