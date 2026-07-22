import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useStore } from '../state/store'
import { SCENARIO_BY_ID, mockReply, scoreSession } from '../data/scenarios'
import { ACADEMY_BY_ID, SKILL_LABEL } from '../data/curriculum'
import { Icon } from '../components/ui'

export default function RolePlay() {
  const { id } = useParams()
  const nav = useNavigate()
  const { state, dispatch } = useStore()
  const scenario = SCENARIO_BY_ID[id]

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [report, setReport] = useState(null)
  const [saved, setSaved] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    if (scenario) setMessages([{ role: 'coach', text: scenario.opener }])
  }, [id]) // eslint-disable-line

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing, report])

  if (!scenario) return <div className="page"><div className="empty">Scenario not found.</div></div>

  const userTurns = messages.filter(m => m.role === 'user').length

  const send = () => {
    const text = input.trim()
    if (!text || typing || report) return
    const turn = userTurns
    const next = [...messages, { role: 'user', text }]
    setMessages(next)
    setInput('')
    setTyping(true)
    setTimeout(() => {
      setMessages(m => [...m, { role: 'coach', text: mockReply(scenario, text, turn) }])
      setTyping(false)
    }, 650 + Math.random() * 500)
  }

  const finish = () => {
    const r = scoreSession(scenario, messages)
    setReport(r)
    dispatch({ type: 'ADD_ROLEPLAY', scenarioId: scenario.id, overall: r.overall, scores: r.scores, xp: r.xp, skill: scenario.skill })
    setSaved(true)
  }

  return (
    <div className="min-h-screen flex flex-col max-w-xl mx-auto">
      {/* header */}
      <div className="sticky top-0 z-20 bg-ink-deep/95 backdrop-blur-md border-b border-ink-line px-4 py-3 flex items-center gap-3">
        <button onClick={() => nav('/coach')} className="icon-btn" aria-label="Leave"><Icon name="ChevronLeft" size={18} /></button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber to-amber-deep flex items-center justify-center shrink-0">
          <Icon name={scenario.icon} size={18} className="text-ink-black" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-paper truncate">{scenario.persona}</div>
          <div className="text-[11px] text-mist truncate">{scenario.title} · {scenario.difficulty}</div>
        </div>
        {!report && (
          <button onClick={finish} disabled={userTurns < 2}
            className="chip-gold !py-1.5 disabled:opacity-40" title={userTurns < 2 ? 'Say a couple of things first' : ''}>
            End & score
          </button>
        )}
      </div>

      {/* goal banner */}
      {!report && (
        <div className="px-4 py-2.5 bg-gold/8 border-b border-gold/20 flex items-start gap-2">
          <Icon name="Target" size={14} className="text-gold-light mt-0.5 shrink-0" />
          <p className="text-[12px] text-chalk"><span className="text-gold-light font-semibold">Goal:</span> {scenario.goal}</p>
        </div>
      )}

      {/* chat */}
      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto pb-4">
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} persona={scenario.persona}>{m.text}</Bubble>
        ))}
        {typing && (
          <Bubble role="coach" persona={scenario.persona}>
            <span className="inline-flex gap-1 items-center">
              <Dot /> <Dot d={0.15} /> <Dot d={0.3} />
            </span>
          </Bubble>
        )}
        {report && <Report report={report} scenario={scenario} />}
        <div ref={endRef} />
      </div>

      {/* input / actions */}
      {report ? (
        <div className="p-4 space-y-2.5 border-t border-ink-line safe-bottom">
          <Link to={`/lesson/${ACADEMY_BY_ID[report.recommend.academyId].lessons[report.recommend.lessonN - 1].id}`}
            className="btn-gold w-full text-sm">
            <Icon name="GraduationCap" size={16} /> Recommended lesson: {report.recommend.label}
          </Link>
          <div className="grid grid-cols-2 gap-2.5">
            <button className="btn-ghost" onClick={() => nav('/coach')}>New scenario</button>
            <button className="btn-ghost" onClick={() => { setMessages([{ role: 'coach', text: scenario.opener }]); setReport(null); setSaved(false) }}>Try again</button>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-ink-line safe-bottom">
          <div className="flex items-end gap-2">
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={`Reply to ${scenario.persona}…`} rows={1}
              className="!min-h-[46px] max-h-32 resize-none" />
            <button onClick={send} disabled={!input.trim() || typing} className="btn-amber !px-4 !py-3 shrink-0" aria-label="Send">
              <Icon name="Send" size={18} />
            </button>
          </div>
          <p className="text-[10px] text-ghost text-center mt-2">
            Practice mode · responses are simulated. <span className="text-mist">Connect a model to go live.</span>
          </p>
        </div>
      )}
    </div>
  )
}

function Bubble({ role, persona, children }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed
        ${isUser ? 'bg-gradient-to-br from-gold to-gold-deep text-ink-black rounded-br-md font-medium'
                 : 'bg-ink-card border border-ink-line text-paper rounded-bl-md'}`}>
        {!isUser && <div className="text-[10px] text-amber-glow font-semibold mb-0.5">{persona}</div>}
        {children}
      </div>
    </div>
  )
}

function Dot({ d = 0 }) {
  return <span className="w-1.5 h-1.5 rounded-full bg-mist inline-block animate-bounce" style={{ animationDelay: `${d}s` }} />
}

function Report({ report, scenario }) {
  return (
    <div className="slide-up pt-2">
      <div className="glass-strong card-pad-lg mb-3 text-center accent-top">
        <div className="eyebrow mb-1">Social Performance Report</div>
        <div className="text-5xl font-bold text-gradient-gold leading-none my-2">{report.overall}</div>
        <div className="text-[12px] text-mist">out of 100 · <span className="text-gold-light font-semibold">+{report.xp} XP earned</span></div>
      </div>

      <div className="glass card-pad mb-3">
        <div className="eyebrow mb-2.5">Breakdown</div>
        <div className="grid grid-cols-1 gap-2">
          {report.rubric.map(k => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-[12px] text-chalk w-32 shrink-0">{k}</span>
              <div className="flex-1 h-1.5 rounded-full bg-ink-card2 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber" style={{ width: `${report.scores[k]}%` }} />
              </div>
              <span className="text-[11px] text-mist tabular-nums w-6 text-right">{report.scores[k]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass card-pad mb-3 border-success/25">
        <div className="flex items-center gap-2 mb-2"><Icon name="ThumbsUp" size={15} className="text-success" /><span className="text-[11px] font-bold uppercase tracking-wider text-success">What you did well</span></div>
        <ul className="space-y-1.5">{report.strengths.map((s, i) => <li key={i} className="text-[13px] text-chalk flex gap-2"><span className="text-success">•</span>{s}</li>)}</ul>
      </div>

      <div className="glass card-pad mb-3 border-amber/25">
        <div className="flex items-center gap-2 mb-2"><Icon name="TrendingUp" size={15} className="text-amber-glow" /><span className="text-[11px] font-bold uppercase tracking-wider text-amber-glow">What could improve</span></div>
        <ul className="space-y-1.5">{report.improvements.map((s, i) => <li key={i} className="text-[13px] text-chalk flex gap-2"><span className="text-amber-glow">•</span>{s}</li>)}</ul>
      </div>

      <div className="glass card-pad">
        <div className="flex items-center gap-2 mb-1.5"><Icon name="Sparkles" size={15} className="text-gold-light" /><span className="text-[11px] font-bold uppercase tracking-wider text-mist">A stronger response</span></div>
        <p className="text-[14px] text-paper italic leading-relaxed">{report.better}</p>
      </div>
    </div>
  )
}
