import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { ACADEMY_BY_ID, ACADEMIES, LESSON_BY_ID, SKILLS } from '../data/curriculum'
import { levelForXp } from '../data/levels'
import { ACHIEVEMENTS } from '../data/achievements'

const STORAGE_KEY = 'wb-social-mastery-v1'
const SKILL_KEYS = SKILLS.map(s => s.key)

// ---- date helpers ---------------------------------------------------------
export const todayStr = () => new Date().toISOString().slice(0, 10)
function daysBetween(a, b) {
  const ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')
  return Math.round(ms / 86400000)
}

const emptySkills = () => Object.fromEntries(SKILL_KEYS.map(k => [k, 0]))

const initialState = {
  version: 1,
  onboarded: false,
  profile: { name: '', goals: [], comfort: 3, hardest: [], pace: '10', dailyGoal: 2 },
  xp: 0,
  streak: { count: 0, longest: 0, lastActive: null },
  lessonsCompleted: {},   // lessonId -> { at, score }
  quizStats: { correct: 0, total: 0 },
  challenges: {},         // challengeId -> { at, reflection, date }
  achievements: {},       // achId -> at
  skills: emptySkills(),  // 0-100 per tracked skill
  baseline: null,         // frozen assessment snapshot
  path: [],               // ordered academy ids
  journal: [],            // { id, date, tags[], happened, feeling, worked, awkward, learned, next }
  roleplays: [],          // { id, scenarioId, at, overall, scores, xp }
  activityLog: {},        // dateStr -> count (for streak/insights)
  settings: { reducedMotion: false, highContrast: false, premium: false, notifications: true },
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw)
    return { ...initialState, ...parsed,
      profile: { ...initialState.profile, ...(parsed.profile || {}) },
      streak: { ...initialState.streak, ...(parsed.streak || {}) },
      skills: { ...emptySkills(), ...(parsed.skills || {}) },
      settings: { ...initialState.settings, ...(parsed.settings || {}) },
    }
  } catch { return initialState }
}

// ---- reducer --------------------------------------------------------------
function bumpSkill(skills, key, amount) {
  if (!key) return skills
  return { ...skills, [key]: Math.max(0, Math.min(100, Math.round((skills[key] || 0) + amount))) }
}

function touchStreak(state, date) {
  const s = state.streak
  let { count, longest, lastActive } = s
  if (lastActive === date) { /* already counted today */ }
  else if (!lastActive) { count = 1 }
  else {
    const gap = daysBetween(lastActive, date)
    if (gap === 1) count = count + 1
    else if (gap > 1) count = 1
  }
  longest = Math.max(longest, count)
  const log = { ...state.activityLog, [date]: (state.activityLog[date] || 0) + 1 }
  return { ...state, streak: { count, longest, lastActive: date }, activityLog: log }
}

function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return { ...initialState }

    case 'COMPLETE_ONBOARDING': {
      const { profile, baseline, path } = action
      return { ...state, onboarded: true, profile: { ...state.profile, ...profile },
        baseline, skills: { ...baseline }, path }
    }

    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } }

    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } }

    case 'COMPLETE_LESSON': {
      const { lessonId, correct, xp } = action
      const lesson = LESSON_BY_ID[lessonId]
      if (!lesson) return state
      const first = !state.lessonsCompleted[lessonId]
      const date = todayStr()
      let next = { ...state,
        lessonsCompleted: { ...state.lessonsCompleted, [lessonId]: { at: Date.now(), correct } },
        xp: state.xp + (first ? xp : Math.round(xp / 4)),
        quizStats: { correct: state.quizStats.correct + (correct ? 1 : 0), total: state.quizStats.total + 1 },
      }
      if (first) {
        const academy = ACADEMY_BY_ID[lesson.academyId]
        let skills = next.skills
        skills = bumpSkill(skills, academy.skills[0], 3 + (correct ? 2 : 0))
        skills = bumpSkill(skills, academy.skills[1], 2)
        next = { ...next, skills }
      }
      return touchStreak(next, date)
    }

    case 'COMPLETE_CHALLENGE': {
      const { challenge, reflection } = action
      if (state.challenges[challenge.id]) return state
      const date = todayStr()
      let next = { ...state,
        challenges: { ...state.challenges, [challenge.id]: { at: Date.now(), reflection: reflection || '', date } },
        xp: state.xp + challenge.xp,
        skills: bumpSkill(state.skills, challenge.skill, 4),
      }
      return touchStreak(next, date)
    }

    case 'ADD_JOURNAL': {
      const entry = { id: 'j' + Date.now(), date: todayStr(), ...action.entry }
      let next = { ...state, journal: [entry, ...state.journal], xp: state.xp + 15 }
      return touchStreak(next, todayStr())
    }

    case 'DELETE_JOURNAL':
      return { ...state, journal: state.journal.filter(j => j.id !== action.id) }

    case 'ADD_ROLEPLAY': {
      const { scenarioId, overall, scores, xp } = action
      const rec = { id: 'r' + Date.now(), scenarioId, at: Date.now(), overall, scores, xp }
      const scenarioSkill = action.skill
      let next = { ...state,
        roleplays: [rec, ...state.roleplays],
        xp: state.xp + xp,
        skills: bumpSkill(state.skills, scenarioSkill, Math.round(overall / 25)),
      }
      return touchStreak(next, todayStr())
    }

    case 'UNLOCK_ACHIEVEMENTS': {
      const now = Date.now()
      const merged = { ...state.achievements }
      let bonus = 0
      action.list.forEach(a => { if (!merged[a.id]) { merged[a.id] = now; bonus += a.xp || 0 } })
      return { ...state, achievements: merged, xp: state.xp + bonus }
    }

    default:
      return state
  }
}

// ---- context --------------------------------------------------------------
const StoreCtx = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const prevAch = useRef(null)

  // persist
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
  }, [state])

  // reflect reduced-motion setting on <body>
  useEffect(() => {
    document.body.setAttribute('data-motion', state.settings.reducedMotion ? 'off' : 'on')
  }, [state.settings.reducedMotion])

  // achievement engine — run after any state change
  useEffect(() => {
    const level = levelForXp(state.xp).level
    const helpers = {
      level,
      academyComplete: (id) => academyProgress(state, id).done === academyProgress(state, id).total,
      anyAcademyComplete: () => ACADEMIES.some(a => {
        const p = academyProgress(state, a.id); return p.total > 0 && p.done === p.total
      }),
    }
    const newly = ACHIEVEMENTS.filter(a => !state.achievements[a.id] && a.check(state, helpers))
    if (newly.length) {
      dispatch({ type: 'UNLOCK_ACHIEVEMENTS', list: newly })
      prevAch.current = newly[newly.length - 1]
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.xp, state.lessonsCompleted, state.challenges, state.journal, state.roleplays, state.streak.longest])

  const value = useMemo(() => ({ state, dispatch, justUnlocked: prevAch }), [state])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// ---- selectors ------------------------------------------------------------
export function academyProgress(state, academyId) {
  const a = ACADEMY_BY_ID[academyId]
  if (!a) return { done: 0, total: 0, pct: 0 }
  const total = a.lessons.length
  const done = a.lessons.filter(l => state.lessonsCompleted[l.id]).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

export function isLessonUnlocked(state, lessonId) {
  const lesson = LESSON_BY_ID[lessonId]
  if (!lesson) return false
  if (!isAcademyUnlocked(state, lesson.academyId)) return false
  if (lesson.index === 0) return true
  const prev = ACADEMY_BY_ID[lesson.academyId].lessons[lesson.index - 1]
  return !!state.lessonsCompleted[prev.id]
}

export function isAcademyUnlocked(state, academyId) {
  const idx = ACADEMIES.findIndex(a => a.id === academyId)
  if (idx <= 1) return true // first two academies open from the start
  const prev = ACADEMIES[idx - 1]
  return academyProgress(state, prev.id).pct >= 50
}

// 0-1000 Social Mastery Score derived from tracked skills.
export function masteryScore(state) {
  const vals = SKILL_KEYS.map(k => state.skills[k] || 0)
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  return Math.round(avg * 10)
}

export function nextLesson(state) {
  const order = state.path && state.path.length ? state.path : ACADEMIES.map(a => a.id)
  for (const aid of order) {
    const a = ACADEMY_BY_ID[aid]
    if (!a) continue
    for (const l of a.lessons) {
      if (!state.lessonsCompleted[l.id] && isLessonUnlocked(state, l.id)) return l
    }
  }
  // everything unlocked done? return first incomplete anywhere
  for (const a of ACADEMIES)
    for (const l of a.lessons)
      if (!state.lessonsCompleted[l.id]) return l
  return null
}

export function totals(state) {
  return {
    lessons: Object.keys(state.lessonsCompleted).length,
    challenges: Object.keys(state.challenges).length,
    roleplays: state.roleplays.length,
    journal: state.journal.length,
  }
}
