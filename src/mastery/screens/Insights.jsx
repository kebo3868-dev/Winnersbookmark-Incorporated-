import { useStore, masteryScore, totals } from '../state/store'
import { levelProgress } from '../data/levels'
import { SKILLS, ACADEMY_BY_ID } from '../data/curriculum'
import { Icon, SkillRadar, SkillBar, StatTile } from '../components/ui'

const RADAR_KEYS = ['confidence','conversation','presence','listening','storytelling','networking','dating','relationships','publicSpeaking','emotionalIntelligence']

export default function Insights() {
  const { state } = useStore()
  const lp = levelProgress(state.xp)
  const t = totals(state)
  const score = masteryScore(state)

  const skills = SKILLS.map(s => ({ ...s, value: state.skills[s.key] || 0, base: state.baseline?.[s.key] || 0 }))
  const sorted = [...skills].sort((a, b) => b.value - a.value)
  const strongest = sorted[0]
  const weakest = sorted[sorted.length - 1]
  const fastest = [...skills].sort((a, b) => (b.value - b.base) - (a.value - a.base))[0]
  const recommend = ACADEMYFORSKILL(weakest.key)

  const radarData = RADAR_KEYS.map(k => ({ label: SKILLS.find(s => s.key === k).label, value: state.skills[k] || 0 }))
  const baseData = RADAR_KEYS.map(k => ({ label: '', value: state.baseline?.[k] || 0 }))

  // last 7 days activity
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ key, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), count: state.activityLog[key] || 0 })
  }
  const maxDay = Math.max(1, ...days.map(d => d.count))
  const weekTotal = days.reduce((a, d) => a + d.count, 0)

  return (
    <div className="page">
      <div className="eyebrow mb-1">Your growth</div>
      <h1 className="display-title mb-5">Insights</h1>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatTile icon="Gauge" label="Mastery Score" value={score} sub="of 1000" />
        <StatTile icon="Star" label="Level" value={`${lp.current.level}`} sub={lp.current.name} accent="amber" />
        <StatTile icon="Flame" label="Current Streak" value={state.streak.count} sub={`Longest ${state.streak.longest}`} accent="amber" />
        <StatTile icon="Zap" label="Total XP" value={state.xp.toLocaleString()} />
        <StatTile icon="GraduationCap" label="Lessons" value={t.lessons} />
        <StatTile icon="Target" label="Missions" value={t.challenges} />
      </div>

      {/* radar */}
      <div className="glass-strong card-pad mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="eyebrow">Skill Profile</div>
          <div className="flex items-center gap-3 text-[10px] text-mist">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gold inline-block" /> Now</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-ghost inline-block" /> Start</span>
          </div>
        </div>
        <SkillRadar data={radarData} compare={baseData} size={290} />
      </div>

      {/* highlights */}
      <div className="grid grid-cols-1 gap-3 mb-4">
        <Highlight icon="TrendingUp" tone="success" label="Strongest skill" name={strongest.label} value={strongest.value} />
        <Highlight icon="Rocket" tone="amber" label="Fastest improving" name={fastest.label} value={`+${Math.max(0, Math.round(fastest.value - fastest.base))}`} suffix=" since start" />
        <Highlight icon="Crosshair" tone="gold" label="Focus next" name={weakest.label} value={weakest.value} />
      </div>

      {/* recommended */}
      {recommend && (
        <div className="glass card-pad mb-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gold/12 border border-gold/40 flex items-center justify-center shrink-0">
            <Icon name={recommend.icon} size={20} className="text-gold-light" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-mist">Recommended for you</div>
            <div className="font-semibold text-paper truncate">{recommend.title}</div>
          </div>
          <a href={`#/academy/${recommend.id}`} onClick={e => e.preventDefault()} className="text-gold-light"><Icon name="ArrowRight" size={18} /></a>
        </div>
      )}

      {/* weekly activity */}
      <div className="glass card-pad mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow">This week</div>
          <span className="text-[11px] text-mist">{weekTotal} activities</span>
        </div>
        <div className="flex items-end justify-between gap-2 h-28">
          {days.map(d => (
            <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex items-end justify-center flex-1">
                <div className="w-full max-w-[26px] rounded-t-md bg-gradient-to-t from-gold-deep to-gold-light transition-all"
                  style={{ height: `${Math.max(6, (d.count / maxDay) * 100)}%`, opacity: d.count ? 1 : 0.25 }} />
              </div>
              <span className="text-[10px] text-mist">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* all skills */}
      <div className="glass card-pad">
        <div className="eyebrow mb-3">All skills</div>
        <div className="space-y-3">
          {sorted.map(s => <SkillBar key={s.key} label={s.label} value={s.value} color={s.value >= 70 ? 'gold' : 'amber'} />)}
        </div>
      </div>
    </div>
  )
}

function Highlight({ icon, tone, label, name, value, suffix }) {
  const color = tone === 'success' ? 'text-success' : tone === 'amber' ? 'text-amber-glow' : 'text-gold-light'
  return (
    <div className="glass card-pad flex items-center gap-3">
      <Icon name={icon} size={20} className={color} />
      <div className="flex-1">
        <div className="text-[11px] text-mist">{label}</div>
        <div className="font-semibold text-paper">{name}</div>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}<span className="text-[10px] text-mist font-normal">{suffix}</span></div>
    </div>
  )
}

const SKILL_TO_ACADEMY = {
  confidence: 'a1', conversation: 'a2', presence: 'a3', listening: 'a4', storytelling: 'a5',
  networking: 'a7', dating: 'a8', relationships: 'a9', publicSpeaking: 'a10', leadership: 'a11',
  emotionalIntelligence: 'a12',
}
function ACADEMYFORSKILL(key) { return ACADEMY_BY_ID[SKILL_TO_ACADEMY[key]] }
