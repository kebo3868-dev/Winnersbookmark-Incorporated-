import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore, masteryScore, totals } from '../state/store'
import { levelProgress, LEVELS } from '../data/levels'
import { ACHIEVEMENTS } from '../data/achievements'
import { Icon, BrandMark, StreakBadge, XPBar } from '../components/ui'

export default function Profile() {
  const { state, dispatch } = useStore()
  const nav = useNavigate()
  const lp = levelProgress(state.xp)
  const t = totals(state)
  const [confirmReset, setConfirmReset] = useState(false)
  const unlocked = ACHIEVEMENTS.filter(a => state.achievements[a.id])

  const reset = () => {
    dispatch({ type: 'RESET' })
    try { localStorage.removeItem('wb-social-mastery-v1') } catch {}
    nav('/onboarding', { replace: true })
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-5">
        <div className="eyebrow">Profile</div>
        <StreakBadge count={state.streak.count} />
      </div>

      {/* identity card */}
      <div className="glass-strong card-pad-lg mb-4 accent-top">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-light to-gold flex items-center justify-center shadow-gold shrink-0">
            <span className="font-display text-2xl font-bold text-ink-black">{(state.profile.name || 'F')[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold text-paper truncate">{state.profile.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="chip-gold">Lv {lp.current.level}</span>
              <span className="text-[13px] text-chalk">{lp.current.name}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gradient-gold leading-none">{masteryScore(state)}</div>
            <div className="text-[9px] text-mist tracking-wider">MASTERY /1000</div>
          </div>
        </div>
        <XPBar pct={lp.pct} />
        <div className="text-[11px] text-mist mt-1.5">
          {lp.next ? <>{lp.into}/{lp.span} XP to {lp.next.name}</> : 'Max level'} · {state.xp.toLocaleString()} XP total
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-ink-line text-center">
          <Stat value={t.lessons} label="Lessons" />
          <Stat value={t.challenges} label="Missions" />
          <Stat value={t.roleplays} label="Role-plays" />
          <Stat value={state.streak.longest} label="Best streak" />
        </div>
      </div>

      {/* quick links */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Link to="/challenges" className="glass card-pad tap flex items-center gap-2.5">
          <Icon name="Target" size={20} className="text-amber-glow" />
          <span className="text-sm font-semibold text-paper">Missions</span>
        </Link>
        <Link to="/journal" className="glass card-pad tap flex items-center gap-2.5">
          <Icon name="PenLine" size={20} className="text-gold-light" />
          <span className="text-sm font-semibold text-paper">Journal</span>
        </Link>
      </div>

      {/* achievements */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title">Achievements</h2>
        <span className="text-[12px] text-mist">{unlocked.length}/{ACHIEVEMENTS.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {ACHIEVEMENTS.map(a => {
          const got = !!state.achievements[a.id]
          return (
            <div key={a.id} className={`glass card-pad flex flex-col items-center text-center gap-1.5 ${got ? '' : 'opacity-45'}`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center
                ${got ? 'bg-gradient-to-br from-gold-light to-gold' : 'bg-ink-card2 border border-ink-line'}`}>
                <Icon name={got ? a.icon : 'Lock'} size={20} className={got ? 'text-ink-black' : 'text-ghost'} />
              </div>
              <div className="text-[11px] font-semibold text-paper leading-tight">{a.title}</div>
              <div className="text-[9px] text-mist leading-tight">{a.desc}</div>
            </div>
          )
        })}
      </div>

      {/* level ladder */}
      <h2 className="section-title mb-3">Ranks</h2>
      <div className="glass card-pad mb-6">
        <div className="space-y-1">
          {LEVELS.map(l => {
            const reached = state.xp >= l.min
            const current = l.level === lp.current.level
            return (
              <div key={l.level} className={`flex items-center gap-3 px-2 py-1.5 rounded-lg ${current ? 'bg-gold/8' : ''}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                  ${reached ? 'bg-gold text-ink-black' : 'bg-ink-card2 text-ghost'}`}>{l.level}</span>
                <span className={`text-[13px] flex-1 ${reached ? 'text-paper font-medium' : 'text-mist'}`}>{l.name}</span>
                {current && <span className="chip-gold !py-0.5 !text-[10px]">You</span>}
                <span className="text-[11px] text-ghost tabular-nums">{l.min.toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* premium */}
      <h2 className="section-title mb-3">Membership</h2>
      <div className={`rounded-2xl border card-pad-lg mb-6 ${state.settings.premium ? 'border-gold/60 bg-gold/8' : 'border-ink-edge bg-gradient-to-b from-ink-card to-ink-card2'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Crown" size={20} className="text-gold-light" />
          <span className="font-display text-lg font-bold text-paper">Premium</span>
          {state.settings.premium && <span className="chip-gold ml-auto">Active</span>}
        </div>
        <ul className="space-y-1.5 mb-4">
          {['All 12 academies unlocked', 'Unlimited AI role-play', 'Advanced analytics & weekly reports', 'Personalized adaptive path', 'Full journal insights'].map(f => (
            <li key={f} className="flex items-center gap-2 text-[13px] text-chalk"><Icon name="Check" size={14} className="text-gold-light shrink-0" />{f}</li>
          ))}
        </ul>
        <button className={state.settings.premium ? 'btn-ghost w-full' : 'btn-gold w-full'}
          onClick={() => dispatch({ type: 'SET_SETTING', key: 'premium', value: !state.settings.premium })}>
          {state.settings.premium ? 'Premium enabled (demo) — turn off' : 'Enable Premium (demo)'}
        </button>
        <p className="text-[10px] text-ghost text-center mt-2">Billing integration point — connect Stripe or app-store billing. No payment keys in the client.</p>
      </div>

      {/* settings */}
      <h2 className="section-title mb-3">Settings</h2>
      <div className="glass card-pad mb-6 divide-y divide-ink-line">
        <Toggle label="Reduced motion" desc="Minimize animations" icon="Accessibility"
          on={state.settings.reducedMotion} onChange={v => dispatch({ type: 'SET_SETTING', key: 'reducedMotion', value: v })} />
        <Toggle label="Daily notifications" desc="Streak & mission reminders" icon="Bell"
          on={state.settings.notifications} onChange={v => dispatch({ type: 'SET_SETTING', key: 'notifications', value: v })} />
      </div>

      {/* danger */}
      <div className="glass card-pad mb-6">
        {!confirmReset ? (
          <button className="w-full text-danger text-sm font-medium flex items-center justify-center gap-2 py-1" onClick={() => setConfirmReset(true)}>
            <Icon name="RotateCcw" size={15} /> Reset all progress
          </button>
        ) : (
          <div className="text-center">
            <p className="text-[13px] text-chalk mb-3">This erases all progress and restarts onboarding. This can’t be undone.</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="inline-flex items-center justify-center gap-2 font-semibold text-white px-5 py-3 rounded-xl bg-danger/90 hover:bg-danger active:scale-[.98] transition" onClick={reset}>Reset</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 pb-4">
        <BrandMark size={28} />
        <p className="text-[11px] text-ghost">Winnersbookmark Social Mastery</p>
        <p className="text-[10px] text-ghost">Designed by Winnersbookmark Incorporated</p>
      </div>
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div>
      <div className="text-lg font-bold text-paper leading-none">{value}</div>
      <div className="text-[10px] text-mist mt-0.5">{label}</div>
    </div>
  )
}

function Toggle({ label, desc, icon, on, onChange }) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Icon name={icon} size={18} className="text-mist" />
      <div className="flex-1">
        <div className="text-[14px] font-medium text-paper">{label}</div>
        <div className="text-[11px] text-mist">{desc}</div>
      </div>
      <button onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label}
        className={`w-12 h-7 rounded-full p-0.5 transition-colors ${on ? 'bg-gold' : 'bg-ink-edge'}`}>
        <span className={`block w-6 h-6 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}
