import CommandLayout from '../../components/CommandLayout';
import { Card, Progress } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';

export default function ProgressDashboard(){
 const { state } = useCommandCenter();
 const stats = [
  ['Total tasks completed', state.dailyMission.filter((x)=>x.completed).length + state.tasks.length],
  ['AI modules completed', state.aiTracks.filter((x)=>x.status==='Complete').length],
  ['Content pieces created', state.contentItems.length],
  ['Workouts completed', state.fitness.workoutDays],
  ['Money saved', state.money.emergencyFund],
  ['Clients contacted', state.business.clients.filter((x)=>x.status!=='Lead').length],
  ['Leads added', state.business.clients.length],
  ['Reviews completed', state.weeklyReviews.length + state.monthlyReviews.length],
  ['Travel fund progress', state.money.travelFund],
  ['Monthly score trend', state.monthlyReviews[0]?.total || 0],
 ];
 return <CommandLayout title="Progress Dashboard"><div className="grid md:grid-cols-2 gap-3">{stats.map(([label,value])=><Card key={label}><p className="text-sm text-wb-muted">{label}</p><p className="text-2xl font-bold">{value}</p><div className="mt-2"><Progress value={Math.min(100, Number(value)||0)} /></div></Card>)}</div></CommandLayout>
}
