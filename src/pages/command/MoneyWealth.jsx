import CommandLayout from '../../components/CommandLayout';
import { Card, Field, Progress } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';

export default function MoneyWealth() {
  const { state, update } = useCommandCenter();
  const m = state.money;
  const set = (k,v) => update('money', { ...m, [k]: Number(v) || 0 });
  const savingsProgress = m.savingsGoal ? Math.round((m.emergencyFund / m.savingsGoal) * 100) : 0;
  const monthlyScore = Math.max(0, Math.min(100, Math.round(((m.monthlyIncome - m.monthlyExpenses + m.businessReinvestment) / Math.max(1, m.monthlyIncome)) * 100)));
  return <CommandLayout title="Money & Wealth Tracker"><Card><div className="grid md:grid-cols-2 gap-2"><Field label="Monthly income" type="number" value={m.monthlyIncome} onChange={(e)=>set('monthlyIncome',e.target.value)}/><Field label="Monthly expenses" type="number" value={m.monthlyExpenses} onChange={(e)=>set('monthlyExpenses',e.target.value)}/><Field label="Savings goal" type="number" value={m.savingsGoal} onChange={(e)=>set('savingsGoal',e.target.value)}/><Field label="Emergency fund amount" type="number" value={m.emergencyFund} onChange={(e)=>set('emergencyFund',e.target.value)}/><Field label="Retirement contribution" type="number" value={m.retirementContribution} onChange={(e)=>set('retirementContribution',e.target.value)}/><Field label="Business reinvestment" type="number" value={m.businessReinvestment} onChange={(e)=>set('businessReinvestment',e.target.value)}/><Field label="Travel fund" type="number" value={m.travelFund} onChange={(e)=>set('travelFund',e.target.value)}/><Field label="Debt balance" type="number" value={m.debtBalance} onChange={(e)=>set('debtBalance',e.target.value)}/></div><p className="text-sm mt-3">Savings progress</p><Progress value={savingsProgress} /><p className="text-sm mt-2">Emergency fund progress</p><Progress value={savingsProgress} /><p className="text-sm mt-2">Travel fund progress</p><Progress value={Math.min(100, (m.travelFund / 5000) * 100)} /><p className="text-sm mt-2">Monthly money score: {monthlyScore}</p></Card></CommandLayout>;
}
