import CommandLayout from '../../components/CommandLayout';
import { Card, Progress } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';
import { options } from '../../lib/commandCenterData';
import { weeklyContentTarget } from '../../lib/commandCenterScoring';

const empty = { id: '', platform: 'TikTok', pillar: 'AI for beginners', title: '', hook: '', scriptIdea: '', status: 'Draft', publishDate: '', notes: '', type: 'short' };

export default function ContentSystem() {
  const { state, update } = useCommandCenter();
  const items = state.contentItems;
  const setItems = (next) => update('contentItems', next);
  const add = () => setItems([{ ...empty, id: crypto.randomUUID() }, ...items]);
  const edit = (id, patch) => setItems(items.map((i) => i.id === id ? { ...i, ...patch } : i));
  const t = weeklyContentTarget(items);
  const progress = Math.min(100, Math.round(((Math.min(2, t.shorts) + Math.min(1, t.carousel) + Math.min(1, t.long)) / 4) * 100));

  return <CommandLayout title="Content Creation System"><Card className="mb-4"><div className="flex justify-between"><h3 className="font-semibold">Weekly Content Target</h3><button className="btn-primary" onClick={add}>Add Content</button></div><p className="text-sm mt-2">2 short videos · 1 carousel/infographic · 1 longer post/article</p><p className="text-xs text-wb-muted mt-1">Shorts: {t.shorts}/2 · Carousel: {t.carousel}/1 · Long: {t.long}/1</p><div className="mt-2"><Progress value={progress} /></div></Card>
  <div className="space-y-3">{items.map((c)=><Card key={c.id}><div className="grid md:grid-cols-3 gap-2"><select value={c.platform} onChange={(e)=>edit(c.id,{platform:e.target.value,type:['YouTube','Blog','Email Newsletter'].includes(e.target.value)?'long':'short'})}>{options.platforms.map((p)=><option key={p}>{p}</option>)}</select><select value={c.pillar} onChange={(e)=>edit(c.id,{pillar:e.target.value})}>{options.pillars.map((p)=><option key={p}>{p}</option>)}</select><input value={c.publishDate} type="date" onChange={(e)=>edit(c.id,{publishDate:e.target.value})} /></div><input className="mt-2" value={c.title} onChange={(e)=>edit(c.id,{title:e.target.value})} placeholder="Title"/><input className="mt-2" value={c.hook} onChange={(e)=>edit(c.id,{hook:e.target.value})} placeholder="Hook"/><textarea className="mt-2" value={c.scriptIdea} onChange={(e)=>edit(c.id,{scriptIdea:e.target.value})} placeholder="Script idea"/><textarea className="mt-2" value={c.notes} onChange={(e)=>edit(c.id,{notes:e.target.value})} placeholder="Notes"/></Card>)}</div></CommandLayout>;
}
