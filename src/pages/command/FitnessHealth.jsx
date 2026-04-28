import CommandLayout from '../../components/CommandLayout';
import { Card, Field, Progress, TextArea } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';

export default function FitnessHealth() {
  const { state, update } = useCommandCenter();
  const f = state.fitness;
  const set = (k, v) => update('fitness', { ...f, [k]: Number(v) || 0 });
  const score = Math.round(((Math.min(3, f.strength) + Math.min(2, f.cardio) + Math.min(1, f.mobility) + Math.min(7, f.waterDays)/7 + (f.mealQuality/100)) / 5) * 100);
  return <CommandLayout title="Fitness & Health Tracker"><Card><div className="grid md:grid-cols-2 gap-2"><Field label="Current weight" type="number" value={f.currentWeight} onChange={(e)=>set('currentWeight',e.target.value)}/><Field label="Goal weight" type="number" value={f.goalWeight} onChange={(e)=>set('goalWeight',e.target.value)}/><Field label="Workout days" type="number" value={f.workoutDays} onChange={(e)=>set('workoutDays',e.target.value)}/><Field label="Strength workouts" type="number" value={f.strength} onChange={(e)=>set('strength',e.target.value)}/><Field label="Cardio sessions" type="number" value={f.cardio} onChange={(e)=>set('cardio',e.target.value)}/><Field label="Mobility sessions" type="number" value={f.mobility} onChange={(e)=>set('mobility',e.target.value)}/><Field label="Water tracking days" type="number" value={f.waterDays} onChange={(e)=>set('waterDays',e.target.value)}/><Field label="Sleep hours" type="number" value={f.sleepHours} onChange={(e)=>set('sleepHours',e.target.value)}/><Field label="Meal quality score" type="number" value={f.mealQuality} onChange={(e)=>set('mealQuality',e.target.value)}/><Field label="Energy score" type="number" value={f.energy} onChange={(e)=>set('energy',e.target.value)}/></div><TextArea label="Acid reflux trigger notes" value={f.refluxNotes} onChange={(e)=>update('fitness',{...f,refluxNotes:e.target.value})}/><p className="text-sm mt-2">Weekly Health Score: {score}</p><Progress value={score} /></Card></CommandLayout>;
}
