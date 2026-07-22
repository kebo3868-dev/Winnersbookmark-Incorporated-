import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/store'
import { Icon, Empty } from '../components/ui'

const TAGS = ['Dating', 'Networking', 'Friendship', 'Work', 'Public Speaking', 'Confidence']

export default function Journal() {
  const { state, dispatch } = useStore()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank())

  function blank() { return { tags: [], happened: '', feeling: '', worked: '', awkward: '', learned: '', next: '' } }
  const toggleTag = (t) => setForm(f => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t] }))

  const save = () => {
    if (!form.happened.trim() && !form.learned.trim()) return
    dispatch({ type: 'ADD_JOURNAL', entry: form })
    setForm(blank()); setOpen(false)
  }

  // AI-style weekly insight (heuristic, marked as generated).
  const insight = weeklyInsight(state.journal)

  return (
    <div className="page">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => nav('/home')} className="icon-btn" aria-label="Back"><Icon name="ChevronLeft" size={18} /></button>
        <div>
          <div className="eyebrow">Reflection</div>
          <h1 className="section-title">Social Journal</h1>
        </div>
        <button onClick={() => setOpen(true)} className="btn-gold ml-auto !py-2 !px-3.5 text-sm"><Icon name="Plus" size={16} /> New</button>
      </div>

      {insight && (
        <div className="glass card-pad mb-4 border-gold/25">
          <div className="flex items-center gap-2 mb-1.5">
            <Icon name="Sparkles" size={15} className="text-gold-light" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-gold-light">Weekly insight</span>
            <span className="chip !py-0.5 !text-[9px] ml-auto">AI-assisted</span>
          </div>
          <p className="text-[14px] text-chalk leading-relaxed">{insight}</p>
        </div>
      )}

      {state.journal.length === 0 ? (
        <Empty icon="PenLine" title="No entries yet">
          After a real interaction, jot down what happened. Patterns emerge fast.
        </Empty>
      ) : (
        <div className="space-y-3">
          {state.journal.map(j => (
            <div key={j.id} className="glass card-pad">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-mist">{new Date(j.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                {(j.tags || []).map(t => <span key={t} className="chip !py-0.5 !text-[10px]">{t}</span>)}
                <button onClick={() => dispatch({ type: 'DELETE_JOURNAL', id: j.id })} className="ml-auto text-ghost hover:text-danger"><Icon name="Trash2" size={14} /></button>
              </div>
              {j.happened && <Line label="What happened" text={j.happened} />}
              {j.feeling && <Line label="How I felt" text={j.feeling} />}
              {j.worked && <Line label="What worked" text={j.worked} />}
              {j.awkward && <Line label="What felt awkward" text={j.awkward} />}
              {j.learned && <Line label="What I learned" text={j.learned} />}
              {j.next && <Line label="Next time" text={j.next} />}
            </div>
          ))}
        </div>
      )}

      {/* new entry sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="glass-strong card-pad-lg w-full max-w-md my-8 slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title">New reflection</h2>
              <button onClick={() => setOpen(false)} className="text-mist hover:text-paper"><Icon name="X" size={18} /></button>
            </div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {TAGS.map(t => (
                <button key={t} onClick={() => toggleTag(t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border tap
                    ${form.tags.includes(t) ? 'bg-gold/12 border-gold/60 text-gold-light' : 'bg-ink-card/60 border-ink-line text-chalk'}`}>{t}</button>
              ))}
            </div>
            <Field label="What happened?" value={form.happened} onChange={v => setForm({ ...form, happened: v })} />
            <Field label="How did I feel?" value={form.feeling} onChange={v => setForm({ ...form, feeling: v })} />
            <Field label="What worked?" value={form.worked} onChange={v => setForm({ ...form, worked: v })} />
            <Field label="What felt awkward?" value={form.awkward} onChange={v => setForm({ ...form, awkward: v })} />
            <Field label="What did I learn?" value={form.learned} onChange={v => setForm({ ...form, learned: v })} />
            <Field label="What will I try next time?" value={form.next} onChange={v => setForm({ ...form, next: v })} />
            <button className="btn-gold w-full mt-2" onClick={save}><Icon name="Check" size={18} /> Save reflection <span className="text-[11px] opacity-80">+15 XP</span></button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <div className="mb-3">
      <label className="label">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} className="!min-h-[64px]" />
    </div>
  )
}

function Line({ label, text }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[10px] uppercase tracking-wider text-ghost font-semibold">{label}</div>
      <p className="text-[13.5px] text-chalk leading-relaxed">{text}</p>
    </div>
  )
}

function weeklyInsight(journal) {
  if (journal.length < 2) return null
  const recent = journal.slice(0, 8)
  const tagCounts = {}
  recent.forEach(j => (j.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1 }))
  const top = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]
  const awkward = recent.filter(j => (j.awkward || '').trim()).length
  const learned = recent.filter(j => (j.learned || '').trim()).length
  const parts = []
  parts.push(`You’ve logged ${journal.length} reflections — the habit itself is doing quiet work.`)
  if (top) parts.push(`Most of your recent practice centers on ${top[0].toLowerCase()}.`)
  if (awkward > learned) parts.push('You notice awkward moments more than lessons — try ending each entry with one thing you’d do differently.')
  else parts.push('You’re extracting clear lessons from interactions, which is exactly how skill compounds.')
  return parts.join(' ')
}
