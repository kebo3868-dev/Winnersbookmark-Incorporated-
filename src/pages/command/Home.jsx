import CommandLayout from '../../components/CommandLayout';
import { Card, Progress } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';
import { BLACK_FLAME_QUOTES } from '../../lib/commandCenterData';
import { dailyLabel, dailyScore } from '../../lib/commandCenterScoring';

export default function Home() {
  const { state, update } = useCommandCenter();
  const score = dailyScore(state.dailyMission);
  const quote = BLACK_FLAME_QUOTES[new Date().getDate() % BLACK_FLAME_QUOTES.length];
  const complete = state.dailyMission.filter((x) => x.completed).length;

  const onPriority = (idx, val) => {
    const next = [...state.top3Priorities];
    next[idx] = val;
    update('top3Priorities', next);
  };

  return <CommandLayout title="Home Dashboard">
    <div className="grid gap-4 md:grid-cols-2">
      <Card><p className="text-sm text-wb-muted">{new Date().toDateString()}</p><h3 className="text-xl font-semibold mt-2">Keith, today is a mission.</h3><p className="mt-2 text-wb-blue-light">{quote}</p></Card>
      <Card><p className="text-sm">Daily Score: <b>{score}</b> — {dailyLabel(score)}</p><div className="mt-2"><Progress value={score} /></div><p className="text-xs mt-2 text-wb-muted">{complete}/7 daily mission items complete</p></Card>
      <Card className="md:col-span-2"><h4 className="font-semibold mb-3">Today's Top 3 Priorities</h4>{state.top3Priorities.map((p, i) => <input key={i} value={p} onChange={(e)=>onPriority(i,e.target.value)} placeholder={`Priority ${i+1}`} className="mb-2" />)}</Card>
      <Card><h4 className="font-semibold mb-2">Weekly Progress</h4><Progress value={(state.weeklyReviews.length % 4) * 25} /></Card>
      <Card><h4 className="font-semibold mb-2">Monthly Progress</h4><Progress value={state.monthlyReviews.at(-1)?.total || 0} /></Card>
      <Card><h4 className="font-semibold">Missed Task Recovery</h4><p className="text-sm text-wb-muted mt-2">No drift. Recover one missed task before sleep.</p></Card>
    </div>
  </CommandLayout>;
}
