import { useNavigate, useParams, Link } from 'react-router-dom'
import { useStore, academyProgress, isLessonUnlocked, isAcademyUnlocked } from '../state/store'
import { ACADEMY_BY_ID, SKILL_LABEL } from '../data/curriculum'
import { Icon } from '../components/ui'

export default function AcademyPath() {
  const { id } = useParams()
  const nav = useNavigate()
  const { state } = useStore()
  const a = ACADEMY_BY_ID[id]

  if (!a || !isAcademyUnlocked(state, id)) {
    return (
      <div className="page">
        <BackBar title="Academy" />
        <div className="empty mt-6">This academy is still locked. Complete earlier academies to open it.</div>
        <Link to="/learn" className="btn-ghost w-full mt-4">Back to library</Link>
      </div>
    )
  }

  const p = academyProgress(state, id)
  const complete = p.done === p.total

  return (
    <div className="min-h-screen pb-16">
      {/* hero */}
      <div className="relative overflow-hidden border-b border-ink-line bg-gradient-to-b from-ink-navy to-ink-black">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-7">
          <BackBar title={`Module ${a.n}`} />
          <div className="flex items-start gap-4 mt-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-light to-gold flex items-center justify-center shadow-gold shrink-0">
              <Icon name={a.icon} size={30} className="text-ink-black" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-bold text-paper leading-tight">{a.title}</h1>
              <p className="text-mist text-[13px] mt-1">{a.blurb}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className="chip-gold">{SKILL_LABEL[a.skills[0]]}</span>
            <span className="chip">{SKILL_LABEL[a.skills[1]]}</span>
            <span className="text-[12px] text-mist ml-auto">{p.done}/{p.total} · {p.pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-ink-card2 overflow-hidden mt-2">
            <div className="h-full bg-gradient-to-r from-gold to-amber transition-all duration-500" style={{ width: `${p.pct}%` }} />
          </div>
        </div>
      </div>

      {/* vertical path */}
      <div className="max-w-md mx-auto px-6 pt-8">
        <div className="relative">
          {a.lessons.map((l, i) => {
            const done = !!state.lessonsCompleted[l.id]
            const unlocked = isLessonUnlocked(state, l.id)
            const isCurrent = unlocked && !done
            const side = i % 2 === 0 ? 'left' : 'right'
            return (
              <Node key={l.id} lesson={l} index={i} side={side}
                state={done ? 'done' : isCurrent ? 'current' : unlocked ? 'open' : 'locked'}
                onClick={() => unlocked && nav(`/lesson/${l.id}`)} />
            )
          })}

          {/* Skill Boss milestone */}
          <div className="relative flex flex-col items-center pt-4">
            <div className="w-0.5 h-8 bg-ink-line" />
            <div className={`w-full rounded-2xl border card-pad text-center
              ${complete ? 'border-gold/60 bg-gold/8' : 'border-ink-line bg-ink-card/40 opacity-70'}`}>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-2
                bg-gradient-to-br from-amber to-amber-deep shadow-[0_0_28px_rgba(245,158,11,0.4)]">
                <Icon name={complete ? 'Trophy' : 'Swords'} size={26} className="text-ink-black" />
              </div>
              <div className="eyebrow !text-amber-glow mb-1">Skill Boss</div>
              <div className="font-display text-lg font-bold text-paper">{a.title} Challenge</div>
              <p className="text-[12px] text-mist mt-1 mb-3">A branching scenario that tests everything you learned.</p>
              {complete ? (
                <Link to={`/roleplay/${bossScenario(a.id)}`} className="btn-amber !py-2.5 text-sm w-full">
                  Enter the arena <Icon name="ArrowRight" size={15} />
                </Link>
              ) : (
                <div className="text-[11px] text-ghost flex items-center justify-center gap-1">
                  <Icon name="Lock" size={12} /> Finish all lessons to unlock
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Map an academy to the most relevant role-play scenario for its boss.
function bossScenario(academyId) {
  const map = { a1: 's-network', a2: 's-coffee', a3: 's-network', a4: 's-date',
    a5: 's-date', a6: 's-friend', a7: 's-network', a8: 's-date', a9: 's-coworker',
    a10: 's-interview', a11: 's-raise', a12: 's-coworker' }
  return map[academyId] || 's-coffee'
}

function BackBar({ title }) {
  const nav = useNavigate()
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => nav('/learn')} className="icon-btn" aria-label="Back"><Icon name="ChevronLeft" size={18} /></button>
      <span className="eyebrow">{title}</span>
    </div>
  )
}

function Node({ lesson, index, side, state, onClick }) {
  const styles = {
    done:    { ring: 'from-success to-emerald-600 border-success text-white', icon: 'Check', line: 'bg-gold/50' },
    current: { ring: 'from-gold-light to-gold border-gold text-ink-black shadow-gold animate-pulse', icon: null, line: 'bg-ink-line' },
    open:    { ring: 'from-ink-card to-ink-card2 border-ink-edge text-chalk', icon: null, line: 'bg-ink-line' },
    locked:  { ring: 'from-ink-card2 to-ink-black border-ink-line text-ghost', icon: 'Lock', line: 'bg-ink-line' },
  }[state]
  const clickable = state !== 'locked'
  return (
    <div className={`relative flex items-center gap-3 mb-7 ${side === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {/* connector spine */}
      {index > 0 && <div className="absolute left-1/2 -top-7 -translate-x-1/2 w-0.5 h-7 bg-ink-line" />}
      <button onClick={clickable ? onClick : undefined} disabled={!clickable}
        className={`relative z-10 w-16 h-16 rounded-full bg-gradient-to-br border-2 flex items-center justify-center shrink-0
          ${styles.ring} ${clickable ? 'tap' : 'cursor-not-allowed'}`}
        aria-label={lesson.title}>
        {styles.icon ? <Icon name={styles.icon} size={22} strokeWidth={2.5} />
                     : <span className="font-bold text-lg">{lesson.n}</span>}
      </button>
      <button onClick={clickable ? onClick : undefined} disabled={!clickable} className={`flex-1 min-w-0 ${clickable ? '' : 'opacity-60'}`}>
        <div className={`text-sm font-semibold truncate ${state === 'locked' ? 'text-ghost' : 'text-paper'}`}>{lesson.title}</div>
        <div className="text-[11px] text-mist truncate">{lesson.teaches}</div>
      </button>
    </div>
  )
}
