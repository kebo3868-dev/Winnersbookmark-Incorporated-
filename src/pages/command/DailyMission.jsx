import CommandLayout from '../../components/CommandLayout';
import { Card, Progress } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';
import { dailyLabel, dailyScore } from '../../lib/commandCenterScoring';

export default function DailyMission() {
  const { state, update } = useCommandCenter();
  const items = state.dailyMission;
  const score = dailyScore(items);

  const edit = (id, patch) => update('dailyMission', items.map((i) => i.id === id ? { ...i, ...patch } : i));
  const addWin = () => update('wins', [{ text: `Win logged ${new Date().toLocaleTimeString()}` }, ...state.wins]);
  const addTask = () => update('tasks', [{ text: `Task added ${new Date().toLocaleTimeString()}` }, ...state.tasks]);

  return <CommandLayout title="Daily Mission">
    <Card className="mb-4"><div className="flex items-center justify-between"><p className="font-semibold">Score {score} — {dailyLabel(score)}</p><div className="flex gap-2"><button className="btn-secondary" onClick={addWin}>Quick Add Win</button><button className="btn-primary" onClick={addTask}>Quick Add Task</button></div></div><div className="mt-2"><Progress value={score} /></div></Card>
    <div className="space-y-3">{items.map((item) => <Card key={item.id}><div className="flex gap-3 items-start"><input type="checkbox" checked={item.completed} onChange={(e)=>edit(item.id,{completed:e.target.checked})} className="mt-1 w-5 h-5" /><input value={item.text} onChange={(e)=>edit(item.id,{text:e.target.value})} /></div></Card>)}</div>
  </CommandLayout>;
}
