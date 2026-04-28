import CommandLayout from '../../components/CommandLayout';
import { Card, TextArea, Field } from '../../components/UiBits';
import { useCommandCenter } from '../../lib/commandCenterStore';

export default function LegacyBuilder(){
 const { state, update } = useCommandCenter();
 const l=state.legacy; const set=(k,v)=>update('legacy',{...l,[k]:v});
 return <CommandLayout title="Legacy Builder"><Card><TextArea label="Books Keith wants to write" value={l.books} onChange={(e)=>set('books',e.target.value)}/><TextArea label="Courses Keith wants to create" value={l.courses} onChange={(e)=>set('courses',e.target.value)}/><TextArea label="People Keith wants to help" value={l.people} onChange={(e)=>set('people',e.target.value)}/><TextArea label="Lessons Keith wants to teach" value={l.lessons} onChange={(e)=>set('lessons',e.target.value)}/><TextArea label="Community impact ideas" value={l.community} onChange={(e)=>set('community',e.target.value)}/><TextArea label="Long-term vision" value={l.longTermVision} onChange={(e)=>set('longTermVision',e.target.value)}/><Field label="2-year vision" value={l.vision2} onChange={(e)=>set('vision2',e.target.value)}/><Field label="5-year vision" value={l.vision5} onChange={(e)=>set('vision5',e.target.value)}/><Field label="10-year vision" value={l.vision10} onChange={(e)=>set('vision10',e.target.value)}/><Field label="20-year vision" value={l.vision20} onChange={(e)=>set('vision20',e.target.value)}/></Card></CommandLayout>
}
