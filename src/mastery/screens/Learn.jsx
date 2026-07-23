import { Link, useNavigate } from 'react-router-dom'
import { useStore, academyProgress, isAcademyUnlocked, nextLesson } from '../state/store'
import { ACADEMIES, ACADEMY_BY_ID, SKILL_LABEL } from '../data/curriculum'
import { Icon, Ring } from '../components/ui'

export default function Learn() {
  const { state } = useStore()
  const nav = useNavigate()
  const cont = nextLesson(state)
  const contAcademy = cont ? ACADEMY_BY_ID[cont.academyId] : null

  return (
    <div className="page">
      <div className="eyebrow mb-1">The Library</div>
      <h1 className="display-title mb-1">Academies</h1>
      <p className="text-mist text-[13px] mb-5">Twelve academies · {ACADEMIES.reduce((n, a) => n + a.lessons.length, 0)} lessons. Master one skill at a time.</p>

      {cont && (
        <button onClick={() => nav(`/lesson/${cont.id}`)} className="glass-strong card-pad w-full text-left mb-5 tap accent-top">
          <div className="eyebrow !text-amber-glow mb-1">Continue learning</div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gold/12 border border-gold/40 flex items-center justify-center shrink-0">
              <Icon name={contAcademy.icon} size={20} className="text-gold-light" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-paper truncate">{cont.title}</div>
              <div className="text-[11px] text-mist truncate">{contAcademy.title}</div>
            </div>
            <Icon name="ArrowRight" size={18} className="text-gold-light" />
          </div>
        </button>
      )}

      <div className="space-y-3">
        {ACADEMIES.map((a, i) => {
          const p = academyProgress(state, a.id)
          const unlocked = isAcademyUnlocked(state, a.id)
          const complete = p.total > 0 && p.done === p.total
          return (
            <Link key={a.id} to={unlocked ? `/academy/${a.id}` : '#'}
              onClick={e => { if (!unlocked) e.preventDefault() }}
              className={`glass card-pad flex items-center gap-4 ${unlocked ? 'tap' : 'opacity-60 cursor-not-allowed'}`}>
              <div className="relative shrink-0">
                <Ring pct={p.pct} size={54} stroke={5} color={complete ? '#10b981' : '#d4af37'}>
                  <Icon name={unlocked ? a.icon : 'Lock'} size={20} className={unlocked ? 'text-paper' : 'text-ghost'} />
                </Ring>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-ghost">0{a.n <= 9 ? a.n : a.n}</span>
                  <h3 className="font-semibold text-paper truncate">{a.title}</h3>
                  {complete && <Icon name="BadgeCheck" size={15} className="text-success shrink-0" />}
                </div>
                <p className="text-[12px] text-mist truncate mt-0.5">{a.subtitle}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="chip !py-0.5 !text-[10px]">{a.lessons.length} lessons</span>
                  <span className="chip-gold !py-0.5 !text-[10px]">{SKILL_LABEL[a.skills[0]]}</span>
                  {unlocked ? <span className="text-[10px] text-mist">{p.done}/{p.total} done</span>
                            : <span className="text-[10px] text-ghost flex items-center gap-1"><Icon name="Lock" size={10} /> Locked</span>}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <p className="text-center text-[11px] text-ghost mt-6">
        Academies unlock as you complete the ones before them.
      </p>
    </div>
  )
}
