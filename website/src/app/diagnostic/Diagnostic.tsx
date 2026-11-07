'use client';

import { useState } from 'react';
import Link from 'next/link';

const questions = [
  { group: 'Communication', text: 'When a call goes unanswered, what happens?', choices: ['A prompt response is automatic', 'Someone checks and replies later', 'We do not reliably follow up'] },
  { group: 'Communication', text: 'How are after-hours inquiries handled?', choices: ['A clear response or next step is available', 'Customers get basic information only', 'They usually have to try again'] },
  { group: 'Digital journey', text: 'Can a visitor easily find the right menu or service information on a phone?', choices: ['Yes, we check it regularly', 'Usually, but we have not tested lately', 'It is difficult or we are not sure'] },
  { group: 'Digital journey', text: 'Are booking or ordering links tested from start to finish?', choices: ['Yes, regularly', 'Occasionally', 'Rarely or never'] },
  { group: 'Lead capture', text: 'Where do catering, event, or higher-value inquiries go?', choices: ['Into a tracked process with an owner', 'Into email or voicemail with manual follow-up', 'They are scattered or often missed'] },
  { group: 'Lead capture', text: 'Can the team see which inquiries still need a response?', choices: ['Yes, in one place', 'With some manual checking', 'No reliable view'] },
  { group: 'Follow-up', text: 'What happens after an inquiry that does not book or buy?', choices: ['A relevant follow-up is scheduled', 'We follow up when someone remembers', 'No consistent follow-up'] },
  { group: 'Follow-up', text: 'Do you have a consistent, appropriate review request process?', choices: ['Yes, with clear rules', 'Only sometimes', 'No process'] },
  { group: 'Visibility', text: 'Can you measure response time and captured inquiries?', choices: ['Yes, consistently', 'Some of it', 'Not currently'] },
  { group: 'Visibility', text: 'How often are customer journey issues reviewed?', choices: ['On a regular schedule', 'When a complaint comes in', 'We have no defined review'] },
] as const;

const groups = ['Communication', 'Digital journey', 'Lead capture', 'Follow-up', 'Visibility'] as const;

export default function Diagnostic() {
  const [answers, setAnswers] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const done = step === questions.length;
  const current = questions[step];
  const scores = groups.map(group => ({
    group,
    score: questions.reduce((total, question, i) => total + (question.group === group ? (answers[i] ?? 0) : 0), 0),
  })).sort((a,b) => b.score - a.score);
  const top = scores[0];
  function answer(value: number) {
    const next = [...answers];
    next[step] = value;
    setAnswers(next);
    setStep(step + 1);
  }
  function reset() { setStep(0); setAnswers([]); }

  return <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
    <section className="card min-h-[425px] p-6 sm:p-10" aria-live="polite">
      {!done ? <>
        <div className="flex items-center justify-between gap-4 text-sm text-snow-dim"><span>{current.group.toUpperCase()}</span><span>QUESTION {step + 1} / {questions.length}</span></div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-night-edge"><div className="h-full bg-cyan-300 transition-all" style={{ width: `${(step / questions.length) * 100}%` }} /></div>
        <h2 className="mt-10 max-w-2xl text-display-sm font-bold text-snow">{current.text}</h2>
        <div className="mt-8 grid gap-3">{current.choices.map((choice, index) => <button type="button" key={choice} onClick={() => answer(index)} className="min-h-[56px] rounded-lg border border-night-edge bg-night-soft px-5 py-4 text-left text-base text-snow-soft transition-colors hover:border-cyan-300 hover:bg-electric-haze focus-visible:ring-2 focus-visible:ring-cyan-300">{choice}<span className="float-right text-cyan-300" aria-hidden="true">↗</span></button>)}</div>
        {step > 0 && <button type="button" className="mt-7 text-sm font-semibold text-electric-light underline underline-offset-4" onClick={() => setStep(step - 1)}>← Previous question</button>}
      </> : <>
        <p className="eyebrow">YOUR OPPORTUNITY PROFILE</p>
        <h2 className="mt-5 text-display-md font-bold text-snow">{top.score === 0 ? 'No major gaps reported.' : `Start with ${top.group.toLowerCase()}.`}</h2>
        <p className="lede mt-4">{top.score === 0 ? 'Your answers suggest defined processes across these areas. A periodic check can confirm that customers experience them as intended.' : 'Based on your answers, this area may deserve the first closer look.'} This is a self-assessment, not a verified audit or a prediction of financial loss.</p>
        <div className="mt-8 grid gap-3">{scores.map(item => <div className="rounded-lg border border-night-edge bg-night-soft p-4" key={item.group}><div className="flex items-center justify-between gap-4"><strong className="text-snow">{item.group}</strong><span className="text-sm text-snow-dim">{item.score >= 3 ? 'Review first' : item.score >= 1 ? 'Some friction' : 'Lower reported friction'}</span></div><div className="mt-3 h-1.5 rounded-full bg-night-edge"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${item.score * 25}%` }} /></div></div>)}</div>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/contact?interest=ai-business-audit" className="btn-primary">Request a full WBI audit ↗</Link><button type="button" onClick={reset} className="btn-secondary">Start over</button></div>
      </>}
    </section>
    <aside className="card h-fit p-6"><p className="eyebrow">WHAT THIS MEANS</p><h2 className="mt-4 text-lg font-bold text-snow">A starting point, not a verdict.</h2><p className="mt-3 text-sm leading-relaxed text-snow-dim">Your responses stay in this browser session. WBI only receives information if you choose to submit the separate contact form.</p><p className="mt-4 text-sm leading-relaxed text-snow-dim">A full audit checks public evidence and makes clear what requires access to internal business data.</p><Link href="/audit" className="btn-ghost mt-5">How our audits work ↗</Link></aside>
  </div>;
}
