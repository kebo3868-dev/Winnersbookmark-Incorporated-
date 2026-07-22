import { Link } from 'react-router-dom'
import { useStore, totals } from '../state/store'
import { SCENARIOS } from '../data/scenarios'
import { SKILL_LABEL } from '../data/curriculum'
import { Icon } from '../components/ui'

const FREE_LIMIT = 3

export default function Coach() {
  const { state } = useStore()
  const t = totals(state)
  const premium = state.settings.premium

  return (
    <div className="page">
      <div className="eyebrow mb-1">Flagship</div>
      <h1 className="display-title mb-1">AI Social Coach</h1>
      <p className="text-mist text-[13px] mb-5">Practice real conversations in a safe space. Get a performance report after every session.</p>

      <div className="glass-strong card-pad mb-5 flex items-center gap-3 accent-top">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber to-amber-deep flex items-center justify-center shrink-0">
          <Icon name="Bot" size={22} className="text-ink-black" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-paper">{t.roleplays} sessions completed</div>
          <div className="text-[11px] text-mist">Rehearse until it feels natural, then take it to the real world.</div>
        </div>
      </div>

      <div className="eyebrow mb-2">Choose a scenario</div>
      <div className="grid grid-cols-1 gap-3">
        {SCENARIOS.map((s, i) => {
          const locked = !premium && i >= FREE_LIMIT
          return (
            <Link key={s.id} to={locked ? '/profile' : `/roleplay/${s.id}`}
              className={`glass card-pad flex items-center gap-4 ${locked ? 'opacity-70' : 'tap'}`}>
              <div className="w-12 h-12 rounded-xl bg-ink-card2 border border-ink-line flex items-center justify-center shrink-0">
                <Icon name={locked ? 'Lock' : s.icon} size={22} className={locked ? 'text-ghost' : 'text-amber-glow'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-paper truncate">{s.title}</h3>
                  <span className="chip !py-0.5 !text-[10px] shrink-0">{s.difficulty}</span>
                </div>
                <p className="text-[12px] text-mist truncate mt-0.5">with {s.persona} · {s.setting}</p>
                <span className="chip-gold !py-0.5 !text-[10px] mt-1.5">{SKILL_LABEL[s.skill]}</span>
              </div>
              <Icon name={locked ? 'Crown' : 'ArrowRight'} size={18} className={locked ? 'text-gold-light' : 'text-mist'} />
            </Link>
          )
        })}
      </div>

      {!premium && (
        <div className="glass card-pad mt-4 text-center">
          <Icon name="Crown" size={20} className="text-gold-light mx-auto mb-1.5" />
          <div className="text-sm font-semibold text-paper">Unlock unlimited role-play</div>
          <p className="text-[12px] text-mist mt-0.5 mb-3">Premium opens every scenario, advanced feedback, and weekly coaching reports.</p>
          <Link to="/profile" className="btn-outline-gold w-full !py-2.5 text-sm">See Premium</Link>
        </div>
      )}
    </div>
  )
}
