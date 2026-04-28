import { useState } from 'react';
import CommandLayout from '../../components/CommandLayout';
import { Card, Field, TextArea, Progress } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';

const blank={ai:0,business:0,content:0,health:0,money:0,relationships:0,travel:0,legacy:0,bigWin:'',lesson:'',improve:'',mission:''};

export default function MonthlyReview(){
  const { state, update } = useCommandCenter();
  const [f,setF]=useState(blank); const on=(k,v)=>setF({...f,[k]:v});
  const total=Math.round((['ai','business','content','health','money','relationships','travel','legacy'].reduce((s,k)=>s+(Number(f[k])||0),0))/8);
  const save=()=>{ update('monthlyReviews',[{...f,total,date:new Date().toISOString()},...state.monthlyReviews]); setF(blank); };
  return <CommandLayout title="Monthly Review"><Card><div className="grid md:grid-cols-2 gap-2">{['ai','business','content','health','money','relationships','travel','legacy'].map((k)=><Field key={k} label={`${k[0].toUpperCase()+k.slice(1)} progress`} type="number" value={f[k]} onChange={(e)=>on(k,Number(e.target.value)||0)}/>)}</div><TextArea label="Biggest win this month" value={f.bigWin} onChange={(e)=>on('bigWin',e.target.value)}/><TextArea label="Biggest lesson" value={f.lesson} onChange={(e)=>on('lesson',e.target.value)}/><TextArea label="What must improve next month" value={f.improve} onChange={(e)=>on('improve',e.target.value)}/><TextArea label="Next month's main mission" value={f.mission} onChange={(e)=>on('mission',e.target.value)}/><p>Total Monthly Score: {total}</p><Progress value={total}/><button className="btn-primary mt-3" onClick={save}>Save Monthly Review</button></Card></CommandLayout>
}
