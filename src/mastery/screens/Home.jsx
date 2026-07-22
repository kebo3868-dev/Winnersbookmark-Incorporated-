import { Link, useNavigate } from 'react-router-dom'
import { useStore, masteryScore, nextLesson, totals } from '../state/store'
import { levelProgress } from '../data/levels'
import { dailyChallenge } from '../data/challenges'
import { ACADEMY_BY_ID } from '../data/curriculum'
import { Icon, Wordmark, StreakBadge, XPBar, Ring, StatTile } from '../components/ui'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const { state, dispatch } = useStore()
  const nav = useNavigate()
  const lp = levelProgress(state.xp)
  const score = masteryScore(state)
  const lesson = nextLesson(state)
  const academy = lesson ? ACADEMY_BY_ID[lesson.academyId] : null
  const today = new Date().toISOString().slice(0, 10)
  const challenge = dailyChallenge(today)
  const challengeDone = !!state.challenges[challenge.id]
  const t = totals(state)
  const goalPct = Math.min(100, Math.round(((state.activityLog[today] || 0) / (state.profile.dailyGoal || 2)) * 100))

  return (
    <div className="page">
      {/* header */}
      <div className="flex items-center justify-between mb-5">
        <Wordmark compact />
        <StreakBadge count={state.streak.count} />
      </div>

      <div className="mb-5">
        <div className="eyebrow mb-1">{greeting()}</div>
        <h1 className="display-title">{state.profile.name} 👋</h1>
      </div>

      {/* level + score strip */}
      <div className="glass-strong card-pad mb-4 accent-top relative overflow-hidden">
        <div className="flex items-center gap-4">
          <Ring pct={score / 10} size={78} stroke={7} color="#f5d061">
            <div className="text-center">
              <div className="text-lg font-bold text-paper leading-none">{score}</div>
              <div className="text-[8px] text-mist tracking-wider">/1000</div>
            </div>
          </Ring>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="chip-gold">Lv {lp.current.level}</span>
              <span className="text-sm font-semibold text-paper truncate">{lp.current.name}</span>
            </div>
            <XPBar pct={lp.pct} className="mb-1.5" />
            <div className="text-[11px] text-mist">
              {lp.next ? <>{lp.into}/{lp.span} XP to <span className="text-gold-light">{lp.next.name}</span></> : 'Max level reached'}
              <span className="mx-1.5">·</span>{state.xp.toLocaleString()} XP total
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-ink-line text-center">
          <MiniStat label="Streak" value={state.streak.count} />
          <MiniStat label="Lessons" value={t.lessons} />
          <MiniStat label="Missions" value={t.challenges} />
          <MiniStat label="Role-plays" value={t.roleplays} />
        </div>
      </div>

      {/* daily goal */}
      <div className="glass card-pad mb-4 flex items-center gap-3">
        <Ring pct={goalPct} size={46} stroke={5} color="#f59e0b">
          <Icon name="Target" size={16} className="text-amber-glow" />
        </Ring>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-paper">Today’s goal</div>
          <div className="text-[11px] text-mist">{Math.min(state.activityLog[today] || 0, state.profile.dailyGoal)}/{state.profile.dailyGoal} activities · {state.profile.pace} min/day</div>
        </div>
        {goalPct >= 100 && <span className="chip-gold"><Icon name="Check" size={12} /> Done</span>}
      </div>

      {/* continue journey */}
      <div className="eyebrow mb-2">Continue your journey</div>
      {lesson ? (
        <button onClick={() => nav(`/lesson/${lesson.id}`)}
          className="glass-strong card-pad-lg w-full text-left mb-4 tap group relative overflow-hidden accent-top">
          <div className="flex items-center gap-2 mb-2">
            <Icon name={academy.icon} size={16} className="text-amber-glow" />
            <span className="eyebrow !text-amber-glow">Module {academy.n} · {academy.title}</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-paper leading-tight mb-1">{lesson.title}</h2>
          <p className="text-mist text-[13px] mb-4">{lesson.teaches}</p>
          <div className="flex items-center justify-between">
            <span className="btn-gold !py-2.5 !px-5 text-sm pointer-events-none">Continue lesson <Icon name="ArrowRight" size={16} /></span>
            <span className="text-[11px] text-mist flex items-center gap-1"><Icon name="Clock" size={12} /> {lesson.minutes} min</span>
          </div>
        </button>
      ) : (
        <div className="glass card-pad mb-4 text-center text-chalk">You’ve completed everything unlocked. 🎉</div>
      )}

      {/* today's challenge */}
      <div className="eyebrow mb-2">Today’s challenge</div>
      <div className={`glass card-pad-lg mb-4 ${challengeDone ? 'opacity-80' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="chip-amber">{challenge.tier}</span>
          <span className="chip-gold">+{challenge.xp} XP</span>
        </div>
        <p className="text-paper font-medium text-[15px] leading-snug mb-3">{challenge.text}</p>
        {challengeDone ? (
          <div className="flex items-center gap-2 text-success text-sm font-semibold">
            <Icon name="CheckCircle2" size={18} /> Completed — nice work
          </div>
        ) : (
          <Link to="/challenges" className="btn-amber !py-2.5 text-sm w-full">Take the challenge <Icon name="ArrowRight" size={16} /></Link>
        )}
      </div>

      {/* quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <QuickCard to="/coach" icon="Bot" title="AI Coach" sub="Practice a real conversation" accent="amber" />
        <QuickCard to="/journal" icon="PenLine" title="Social Journal" sub="Reflect on an interaction" accent="gold" />
      </div>

      <p className="text-center text-[10px] text-ghost mt-8">Designed by Winnersbookmark Incorporated</p>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="flex-1">
      <div className="text-lg font-bold text-paper leading-none">{value}</div>
      <div className="text-[10px] text-mist mt-0.5">{label}</div>
    </div>
  )
}

function QuickCard({ to, icon, title, sub, accent }) {
  const tone = accent === 'amber' ? 'text-amber-glow' : 'text-gold-light'
  return (
    <Link to={to} className="glass card-pad tap">
      <Icon name={icon} size={22} className={`${tone} mb-2`} />
      <div className="font-semibold text-paper text-sm">{title}</div>
      <div className="text-[11px] text-mist mt-0.5 leading-snug">{sub}</div>
    </Link>
  )
}
