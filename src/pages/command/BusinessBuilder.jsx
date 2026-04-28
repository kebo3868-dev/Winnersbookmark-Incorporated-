import CommandLayout from '../../components/CommandLayout';
import { Card, Field } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';
import { options } from '../../lib/commandCenterData';

const emptyLead = { id: '', businessName: '', contactPerson: '', phone: '', email: '', niche: 'Restaurants', offer: 'Missed-call text-back system', status: 'Lead', notes: '', followUpDate: '' };

export default function BusinessBuilder() {
  const { state, update } = useCommandCenter();
  const business = state.business;
  const setBusiness = (patch) => update('business', { ...business, ...patch });
  const setPricing = (key, value) => setBusiness({ pricing: { ...business.pricing, [key]: Number(value) || 0 } });
  const addClient = () => setBusiness({ clients: [{ ...emptyLead, id: crypto.randomUUID() }, ...business.clients] });
  const setClient = (id, patch) => setBusiness({ clients: business.clients.map((c) => c.id === id ? { ...c, ...patch } : c) });

  return <CommandLayout title="Business Builder">
    <Card className="mb-4"><h3 className="font-semibold">Winnersbookmark AI Agency</h3><div className="grid md:grid-cols-2 gap-3 mt-3"><div><label className="label">Niche selector</label><select value={business.niche} onChange={(e)=>setBusiness({niche:e.target.value})}>{options.niches.map((n)=><option key={n}>{n}</option>)}</select></div><div><label className="label">Offer builder</label><select value={business.offer} onChange={(e)=>setBusiness({offer:e.target.value})}>{options.offers.map((n)=><option key={n}>{n}</option>)}</select></div></div></Card>
    <Card className="mb-4"><div className="flex justify-between"><h4 className="font-semibold">Client Pipeline</h4><button className="btn-primary" onClick={addClient}>Add Client</button></div><div className="space-y-3 mt-3">{business.clients.map((c)=><div key={c.id} className="border border-wb-border rounded-lg p-3"><input value={c.businessName} onChange={(e)=>setClient(c.id,{businessName:e.target.value})} placeholder="Business name" className="mb-2"/><div className="grid grid-cols-2 gap-2"><input value={c.contactPerson} onChange={(e)=>setClient(c.id,{contactPerson:e.target.value})} placeholder="Contact person"/><input value={c.phone} onChange={(e)=>setClient(c.id,{phone:e.target.value})} placeholder="Phone"/><input value={c.email} onChange={(e)=>setClient(c.id,{email:e.target.value})} placeholder="Email"/><input value={c.followUpDate} type="date" onChange={(e)=>setClient(c.id,{followUpDate:e.target.value})}/></div><div className="grid grid-cols-3 gap-2 mt-2"><select value={c.niche} onChange={(e)=>setClient(c.id,{niche:e.target.value})}>{options.niches.map((n)=><option key={n}>{n}</option>)}</select><select value={c.offer} onChange={(e)=>setClient(c.id,{offer:e.target.value})}>{options.offers.map((n)=><option key={n}>{n}</option>)}</select><select value={c.status} onChange={(e)=>setClient(c.id,{status:e.target.value})}>{options.pipelineStatus.map((n)=><option key={n}>{n}</option>)}</select></div><textarea className="mt-2" value={c.notes} onChange={(e)=>setClient(c.id,{notes:e.target.value})} placeholder="Notes"/></div>)}</div></Card>
    <Card><h4 className="font-semibold mb-2">Pricing Tracker</h4><div className="grid md:grid-cols-2 gap-2"><Field label="Setup fee" type="number" value={business.pricing.setupFee} onChange={(e)=>setPricing('setupFee',e.target.value)}/><Field label="Monthly retainer" type="number" value={business.pricing.monthlyRetainer} onChange={(e)=>setPricing('monthlyRetainer',e.target.value)}/><Field label="Projected monthly revenue" type="number" value={business.pricing.projectedRevenue} onChange={(e)=>setPricing('projectedRevenue',e.target.value)}/><Field label="Actual monthly revenue" type="number" value={business.pricing.actualRevenue} onChange={(e)=>setPricing('actualRevenue',e.target.value)}/></div></Card>
  </CommandLayout>;
}
