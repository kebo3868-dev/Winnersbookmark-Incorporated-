import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/store'
import { GOALS, HARD_SITUATIONS, PACES, buildBaseline, buildPath } from '../data/onboarding'
import { SKILLS, ACADEMY_BY_ID } from '../data/curriculum'
import { Icon, Wordmark, SkillRadar, StatTile } from '../components/ui'

const RADAR_KEYS = ['confidence','conversation','presence','listening','storytelling','networking','dating','relationships','publicSpeaking','emotionalIntelligence']

export default function Onboarding() {
  const { dispatch } = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [goals, setGoals] = useState([])
  const [comfort, setComfort] = useState(3)
  const [hardest, setHardest] = useState([])
  const [pace, setPace] = useState('10')

  const baseline = useMemo(
    () => buildBaseline({ goals, comfort, hardest, allSkills: SKILLS }),
    [goals, comfort, hardest]
  )
  const path = useMemo(() => buildPath(goals), [goals])
  const radarData = RADAR_KEYS.map(k => ({ label: SKILLS.find(s => s.key === k).label, value: baseline[k] }))
  const overall = Math.round(Object.values(baseline).reduce((a, b) => a + b, 0) / Object.values(baseline).length * 10)

  const toggle = (arr, set, key, max = 99) =>
    set(arr.includes(key) ? arr.filter(x => x !== key) : arr.length < max ? [...arr, key] : arr)

  const steps = [
    { valid: true },                       // welcome
    { valid: goals.length > 0 },           // goals
    { valid: true },                       // comfort
    { valid: hardest.length > 0 },         // hardest
    { valid: true },                       // pace
    { valid: true },                       // results
  ]

  const finish = () => {
    dispatch({ type: 'COMPLETE_ONBOARDING',
      profile: { name: name.trim() || 'Friend', goals, comfort, hardest, pace, dailyGoal: PACES.find(p => p.key === pace)?.goal || 2 },
      baseline, path })
    nav('/home', { replace: true })
  }

  const next = () => step < steps.length - 1 ? setStep(step + 1) : finish()

  return (
    <div className="min-h-screen flex flex-col max-w-xl mx-auto px-5 pt-6 pb-8">
      {/* progress */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => step > 0 && setStep(step - 1)}
          className={`icon-btn ${step === 0 ? 'opacity-0 pointer-events-none' : ''}`} aria-label="Back">
          <Icon name="ChevronLeft" size={18} />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-ink-card2 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-gold to-amber transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <span className="text-[11px] text-mist tabular-nums w-9 text-right">{step + 1}/{steps.length}</span>
      </div>

      <div className="flex-1 slide-up" key={step}>
        {step === 0 && (
          <div className="pt-6">
            <div className="mb-8"><Wordmark /></div>
            <h1 className="hero-title text-gradient-cinematic mb-3">Build confidence.<br />Master conversation.<br />Create real connection.</h1>
            <p className="text-chalk text-[15px] leading-relaxed mb-6">
              A guided journey to real-world social skill — grounded in confidence, respect, and authenticity.
              Answer a few questions and we’ll build your personalized 30-day path.
            </p>
            <label className="label">What should we call you?</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your first name"
              className="text-base" autoFocus />
          </div>
        )}

        {step === 1 && (
          <Question title="What would you most like to improve?" hint="Pick everything that resonates.">
            <div className="grid grid-cols-2 gap-2.5">
              {GOALS.map(g => (
                <Choice key={g.key} active={goals.includes(g.key)} onClick={() => toggle(goals, setGoals, g.key)}>
                  {g.label}
                </Choice>
              ))}
            </div>
          </Question>
        )}

        {step === 2 && (
          <Question title="How comfortable are you starting conversations with strangers?" hint="Be honest — this only calibrates your start.">
            <div className="flex items-center justify-between gap-2 mt-2">
              {[1, 2, 3, 4, 5].map(v => (
                <button key={v} onClick={() => setComfort(v)}
                  className={`flex-1 aspect-square rounded-2xl border text-lg font-bold tap
                    ${comfort === v ? 'bg-gradient-to-br from-gold-light to-gold text-ink-black border-gold shadow-gold'
                                    : 'bg-ink-card/60 border-ink-line text-chalk'}`}>
                  {v}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-mist mt-2 px-1">
              <span>Very uncomfortable</span><span>Very comfortable</span>
            </div>
          </Question>
        )}

        {step === 3 && (
          <Question title="What situation is hardest for you?" hint="Choose the ones that hit home.">
            <div className="grid grid-cols-2 gap-2.5">
              {HARD_SITUATIONS.map(s => (
                <Choice key={s.key} active={hardest.includes(s.key)} onClick={() => toggle(hardest, setHardest, s.key)}>
                  {s.label}
                </Choice>
              ))}
            </div>
          </Question>
        )}

        {step === 4 && (
          <Question title="How often do you want to practice?" hint="Small and consistent beats big and rare.">
            <div className="space-y-2.5 mt-1">
              {PACES.map(p => (
                <button key={p.key} onClick={() => setPace(p.key)}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border tap
                    ${pace === p.key ? 'bg-gold/10 border-gold/60' : 'bg-ink-card/60 border-ink-line'}`}>
                  <span className="font-semibold text-paper">{p.label}</span>
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${pace === p.key ? 'border-gold bg-gold' : 'border-ink-edge'}`}>
                    {pace === p.key && <Icon name="Check" size={12} className="text-ink-black" />}
                  </span>
                </button>
              ))}
            </div>
          </Question>
        )}

        {step === 5 && (
          <div>
            <div className="eyebrow mb-1">Your assessment</div>
            <h1 className="display-title mb-1">Social Skills Baseline</h1>
            <p className="text-mist text-[13px] mb-4">Here’s where you’re starting. Every rep moves these up.</p>

            <div className="glass-strong card-pad mb-4">
              <div className="flex items-center justify-center gap-6 mb-2">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gradient-gold leading-none">{overall}</div>
                  <div className="eyebrow mt-1">Mastery Score / 1000</div>
                </div>
              </div>
              <SkillRadar data={radarData} size={280} />
            </div>

            <div className="glass card-pad">
              <div className="eyebrow mb-2">Your 30-Day Social Mastery Path</div>
              <div className="space-y-2">
                {path.slice(0, 4).map((id, i) => {
                  const a = ACADEMY_BY_ID[id]
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-gold/15 border border-gold/40 flex items-center justify-center text-[11px] font-bold text-gold-light">{i + 1}</div>
                      <Icon name={a.icon} size={16} className="text-amber-glow" />
                      <span className="text-sm font-medium text-paper">{a.title}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <button className="btn-gold w-full text-base mt-6" disabled={!steps[step].valid} onClick={next}>
        {step === 0 ? 'Begin assessment' : step === steps.length - 1 ? 'Start my journey' : 'Continue'}
        <Icon name="ArrowRight" size={18} />
      </button>
    </div>
  )
}

function Question({ title, hint, children }) {
  return (
    <div className="pt-2">
      <h1 className="display-title mb-1.5">{title}</h1>
      {hint && <p className="text-mist text-[13px] mb-5">{hint}</p>}
      {children}
    </div>
  )
}

function Choice({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3.5 py-3.5 rounded-xl border text-sm font-medium text-left tap
        ${active ? 'bg-gold/12 border-gold/60 text-paper' : 'bg-ink-card/60 border-ink-line text-chalk'}`}>
      <span className="flex items-center justify-between gap-2">
        {children}
        {active && <Icon name="Check" size={15} className="text-gold-light shrink-0" />}
      </span>
    </button>
  )
}
