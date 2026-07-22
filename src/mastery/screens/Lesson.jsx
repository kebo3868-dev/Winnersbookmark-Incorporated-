import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore, isLessonUnlocked, nextLesson } from '../state/store'
import { LESSON_BY_ID, ACADEMY_BY_ID, getLessonContent } from '../data/curriculum'
import { Icon } from '../components/ui'

const BASE_XP = 60

export default function Lesson() {
  const { id } = useParams()
  const nav = useNavigate()
  const { state, dispatch } = useStore()
  const lesson = LESSON_BY_ID[id]
  const content = useMemo(() => getLessonContent(id), [id])

  const [step, setStep] = useState(0)
  const [answer, setAnswer] = useState(null)
  const [reflection, setReflection] = useState('')
  const [saved, setSaved] = useState(false)

  if (!lesson || !content) {
    return <div className="page"><div className="empty">Lesson not found.</div></div>
  }
  if (!isLessonUnlocked(state, id) && !state.lessonsCompleted[id]) {
    return (
      <div className="page">
        <div className="empty mt-10">Finish the previous lesson to unlock this one.</div>
        <button className="btn-ghost w-full mt-4" onClick={() => nav(-1)}>Go back</button>
      </div>
    )
  }

  const academy = ACADEMY_BY_ID[lesson.academyId]
  const correct = answer != null && content.quiz.options[answer].correct
  const xp = BASE_XP + (correct ? 15 : 0)

  const cards = [
    { kind: 'hook', label: 'The Hook', icon: 'Zap', body: content.hook },
    { kind: 'idea', label: 'Core Idea', icon: 'Lightbulb', body: content.idea },
    { kind: 'example', label: 'In Practice', icon: 'Eye', body: content.example },
    { kind: 'contrast', label: 'Bad vs. Better', icon: 'GitCompareArrows' },
    { kind: 'quiz', label: 'Your Move', icon: 'CircleHelp' },
    { kind: 'challenge', label: 'Micro-Challenge', icon: 'Target', body: content.challenge },
    { kind: 'reflect', label: 'Reflect', icon: 'PenLine' },
    { kind: 'reward', label: 'Complete', icon: 'Trophy' },
  ]
  const card = cards[step]
  const total = cards.length
  const canAdvance = card.kind === 'quiz' ? answer != null : true

  const complete = () => {
    dispatch({ type: 'COMPLETE_LESSON', lessonId: id, correct, xp })
    if (reflection.trim()) {
      dispatch({ type: 'ADD_JOURNAL', entry: {
        tags: [academy.title], happened: `Lesson: ${lesson.title}`, feeling: '',
        worked: '', awkward: '', learned: reflection.trim(), next: '' } })
    }
    setSaved(true)
    setStep(total - 1)
  }

  const advance = () => {
    if (card.kind === 'reflect') { complete(); return }
    if (step < total - 2) setStep(step + 1)
    else if (step === total - 2) complete()
  }

  const goNext = () => {
    const nl = nextLesson(state)
    if (nl && nl.id !== id) nav(`/lesson/${nl.id}`, { replace: true })
    else nav(`/academy/${academy.id}`, { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col max-w-xl mx-auto px-5 pt-5 pb-6">
      {/* top bar */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => nav(`/academy/${academy.id}`)} className="icon-btn" aria-label="Exit lesson"><Icon name="X" size={18} /></button>
        <div className="flex-1 flex gap-1">
          {cards.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-gold' : 'bg-ink-card2'}`} />
          ))}
        </div>
      </div>

      <div className="mb-1 flex items-center gap-2">
        <Icon name={academy.icon} size={14} className="text-amber-glow" />
        <span className="eyebrow !text-amber-glow">{academy.title} · {lesson.title}</span>
      </div>

      <div className="flex-1 slide-up" key={step}>
        {card.kind === 'reward' ? (
          <Reward xp={xp} correct={correct} lesson={lesson} />
        ) : (
          <>
            <div className="flex items-center gap-2 mt-4 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gold/12 border border-gold/40 flex items-center justify-center">
                <Icon name={card.icon} size={18} className="text-gold-light" />
              </div>
              <h1 className="section-title">{card.label}</h1>
            </div>

            {['hook', 'idea', 'example', 'challenge'].includes(card.kind) && (
              <div className="glass-strong card-pad-lg">
                <p className="text-paper text-[16px] leading-relaxed">{card.body}</p>
                {card.kind === 'challenge' && (
                  <div className="chip-amber mt-4"><Icon name="Sparkles" size={12} /> Do this today for the full effect</div>
                )}
              </div>
            )}

            {card.kind === 'contrast' && (
              <div className="space-y-3">
                <div className="glass card-pad border-danger/30">
                  <div className="flex items-center gap-2 mb-1.5"><Icon name="ThumbsDown" size={16} className="text-danger" /><span className="text-[11px] font-bold uppercase tracking-wider text-danger">What usually goes wrong</span></div>
                  <p className="text-chalk text-[15px] leading-relaxed">{content.bad}</p>
                </div>
                <div className="glass card-pad border-success/30">
                  <div className="flex items-center gap-2 mb-1.5"><Icon name="ThumbsUp" size={16} className="text-success" /><span className="text-[11px] font-bold uppercase tracking-wider text-success">The better approach</span></div>
                  <p className="text-paper text-[15px] leading-relaxed">{content.better}</p>
                </div>
              </div>
            )}

            {card.kind === 'quiz' && (
              <Quiz quiz={content.quiz} answer={answer} setAnswer={setAnswer} />
            )}

            {card.kind === 'reflect' && (
              <div>
                <div className="glass-strong card-pad-lg mb-3">
                  <p className="text-paper text-[16px] leading-relaxed">{content.reflect}</p>
                </div>
                <label className="label">Your reflection (optional — saved to your journal)</label>
                <textarea value={reflection} onChange={e => setReflection(e.target.value)}
                  placeholder="What did you notice?" />
              </div>
            )}
          </>
        )}
      </div>

      {/* footer */}
      {card.kind === 'reward' ? (
        <div className="space-y-2.5 mt-6">
          <button className="btn-gold w-full text-base" onClick={goNext}>Next lesson <Icon name="ArrowRight" size={18} /></button>
          <button className="btn-ghost w-full" onClick={() => nav(`/academy/${academy.id}`)}>Back to path</button>
        </div>
      ) : (
        <button className="btn-gold w-full text-base mt-6" disabled={!canAdvance} onClick={advance}>
          {card.kind === 'reflect' ? 'Complete lesson' : card.kind === 'quiz' ? (answer != null ? 'Continue' : 'Choose an answer') : 'Continue'}
          <Icon name="ArrowRight" size={18} />
        </button>
      )}
    </div>
  )
}

function Quiz({ quiz, answer, setAnswer }) {
  const answered = answer != null
  return (
    <div>
      <div className="glass card-pad mb-3">
        <p className="text-paper font-semibold text-[16px] leading-snug">{quiz.q}</p>
      </div>
      <div className="space-y-2.5">
        {quiz.options.map((opt, i) => {
          const chosen = answer === i
          const showState = answered && (opt.correct || chosen)
          const cls = !answered ? 'bg-ink-card/60 border-ink-line text-chalk'
            : opt.correct ? 'bg-success/12 border-success/60 text-paper'
            : chosen ? 'bg-danger/12 border-danger/60 text-paper'
            : 'bg-ink-card/40 border-ink-line text-mist opacity-60'
          return (
            <button key={i} onClick={() => !answered && setAnswer(i)} disabled={answered}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left text-[14px] tap ${cls}`}>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                ${showState && opt.correct ? 'border-success bg-success' : showState && chosen ? 'border-danger bg-danger' : 'border-ink-edge'}`}>
                {showState && opt.correct && <Icon name="Check" size={12} className="text-ink-black" />}
                {showState && chosen && !opt.correct && <Icon name="X" size={12} className="text-white" />}
              </span>
              <span className="flex-1">{opt.text}</span>
            </button>
          )
        })}
      </div>
      {answered && (
        <div className="glass card-pad mt-3 slide-up">
          <div className="flex items-center gap-2 mb-1">
            <Icon name={quiz.options[answer].correct ? 'CheckCircle2' : 'Info'} size={16}
              className={quiz.options[answer].correct ? 'text-success' : 'text-amber-glow'} />
            <span className="text-[12px] font-bold uppercase tracking-wider text-mist">
              {quiz.options[answer].correct ? 'Exactly right' : 'Good to know'}
            </span>
          </div>
          <p className="text-chalk text-[14px] leading-relaxed">{quiz.explain}</p>
        </div>
      )}
    </div>
  )
}

function Reward({ xp, correct, lesson }) {
  return (
    <div className="flex flex-col items-center justify-center text-center pt-10">
      <div className="pop w-24 h-24 rounded-3xl bg-gradient-to-br from-gold-light to-gold flex items-center justify-center shadow-gold-lg mb-5">
        <Icon name="Trophy" size={48} className="text-ink-black" />
      </div>
      <div className="eyebrow mb-1">Lesson complete</div>
      <h1 className="font-display text-3xl font-bold text-paper mb-2">{lesson.title}</h1>
      <div className="flex items-center gap-2 mb-3">
        <span className="chip-gold text-sm !px-3 !py-1.5"><Icon name="Zap" size={14} /> +{xp} XP</span>
        {correct && <span className="chip !px-3 !py-1.5 text-success border-success/40"><Icon name="Check" size={14} /> Perfect answer</span>}
      </div>
      <p className="text-mist text-[14px] max-w-xs">Progress saved. Keep the streak alive — one small rep a day compounds fast.</p>
    </div>
  )
}
