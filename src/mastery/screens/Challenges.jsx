import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/store'
import { CHALLENGES, TIERS, TIER_META, dailyChallenge } from '../data/challenges'
import { SKILL_LABEL } from '../data/curriculum'
import { Icon } from '../components/ui'

export default function Challenges() {
  const { state, dispatch } = useStore()
  const nav = useNavigate()
  const [active, setActive] = useState(null)   // challenge being reflected on
  const [reflection, setReflection] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const daily = dailyChallenge(today)

  const done = (id) => !!state.challenges[id]
  const completeCount = Object.keys(state.challenges).length

  const submit = () => {
    dispatch({ type: 'COMPLETE_CHALLENGE', challenge: active, reflection })
    setActive(null); setReflection('')
  }

  return (
    <div className="page">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => nav('/home')} className="icon-btn" aria-label="Back"><Icon name="ChevronLeft" size={18} /></button>
        <div>
          <div className="eyebrow">Real-world</div>
          <h1 className="section-title">Missions</h1>
        </div>
        <span className="chip-gold ml-auto">{completeCount} done</span>
      </div>

      {/* daily */}
      <div className="glass-strong card-pad-lg mb-5 accent-top">
        <div className="flex items-center gap-2 mb-2">
          <span className="chip-amber"><Icon name="Sun" size={12} /> Today’s mission</span>
          <span className="chip-gold">+{daily.xp} XP</span>
        </div>
        <p className="text-paper font-medium text-[15px] mb-3">{daily.text}</p>
        {done(daily.id)
          ? <div className="flex items-center gap-2 text-success text-sm font-semibold"><Icon name="CheckCircle2" size={18} /> Completed</div>
          : <button className="btn-amber w-full !py-2.5 text-sm" onClick={() => setActive(daily)}>I did it — log reflection</button>}
      </div>

      <p className="text-mist text-[13px] mb-4">Growth happens outside the app. Complete missions in real life, then reflect on what you learned.</p>

      {TIERS.map(tier => (
        <div key={tier} className="mb-5">
          <div className="flex items-center gap-2 mb-2.5">
            <span className={`w-2 h-2 rounded-full`} style={{ background: colorHex(TIER_META[tier].color) }} />
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-chalk">{tier}</h2>
          </div>
          <div className="space-y-2.5">
            {CHALLENGES.filter(c => c.tier === tier).map(c => {
              const complete = done(c.id)
              return (
                <div key={c.id} className={`glass card-pad flex items-center gap-3 ${complete ? 'opacity-70' : ''}`}>
                  <button onClick={() => !complete && setActive(c)} disabled={complete}
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 tap
                      ${complete ? 'border-success bg-success' : 'border-ink-edge hover:border-gold'}`}
                    aria-label={complete ? 'Completed' : 'Mark complete'}>
                    {complete && <Icon name="Check" size={16} className="text-ink-black" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] ${complete ? 'text-mist line-through' : 'text-paper'}`}>{c.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="chip-gold !py-0.5 !text-[10px]">+{c.xp} XP</span>
                      <span className="text-[10px] text-mist">{SKILL_LABEL[c.skill]}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* reflection sheet */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setActive(null)}>
          <div className="glass-strong card-pad-lg w-full max-w-md slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <span className="chip-amber">{active.tier}</span>
              <span className="chip-gold">+{active.xp} XP</span>
              <button onClick={() => setActive(null)} className="ml-auto text-mist hover:text-paper"><Icon name="X" size={18} /></button>
            </div>
            <p className="text-paper font-medium mb-4">{active.text}</p>
            <label className="label">{active.prompt}</label>
            <textarea value={reflection} onChange={e => setReflection(e.target.value)} placeholder="A sentence or two is plenty…" autoFocus />
            <button className="btn-gold w-full mt-4" onClick={submit}>
              <Icon name="Check" size={18} /> Complete mission
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function colorHex(name) {
  return { success: '#10b981', amber: '#f59e0b', gold: '#d4af37', danger: '#ef4444' }[name] || '#d4af37'
}
