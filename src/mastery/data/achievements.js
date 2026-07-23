// Achievements. Each has a `check(state, helpers)` predicate evaluated after
// any state change; newly-true achievements are unlocked and awarded XP.
export const ACHIEVEMENTS = [
  {
    id: 'first-move', icon: 'Footprints', title: 'First Move', xp: 50,
    desc: 'Complete your first real-world challenge.',
    check: (s) => Object.keys(s.challenges).length >= 1,
  },
  {
    id: 'first-lesson', icon: 'GraduationCap', title: 'Day One', xp: 40,
    desc: 'Finish your first lesson.',
    check: (s) => Object.keys(s.lessonsCompleted).length >= 1,
  },
  {
    id: 'the-connector', icon: 'Users', title: 'The Connector', xp: 120,
    desc: 'Log five interactions in your Social Journal.',
    check: (s) => s.journal.length >= 5,
  },
  {
    id: 'storyteller', icon: 'BookOpen', title: 'Storyteller', xp: 150,
    desc: 'Complete the Storytelling academy.',
    check: (s, h) => h.academyComplete('a5'),
  },
  {
    id: 'fear-breaker', icon: 'Flame', title: 'Fear Breaker', xp: 200,
    desc: 'Complete ten real-world challenges.',
    check: (s) => Object.keys(s.challenges).length >= 10,
  },
  {
    id: 'consistency', icon: 'CalendarCheck', title: 'Consistency', xp: 300,
    desc: 'Maintain a 30-day streak.',
    check: (s) => s.streak.longest >= 30,
  },
  {
    id: 'week-strong', icon: 'Flame', title: 'Warming Up', xp: 80,
    desc: 'Reach a 7-day streak.',
    check: (s) => s.streak.longest >= 7,
  },
  {
    id: 'role-player', icon: 'Bot', title: 'In the Arena', xp: 90,
    desc: 'Finish your first AI role-play.',
    check: (s) => s.roleplays.length >= 1,
  },
  {
    id: 'ten-lessons', icon: 'Award', title: 'Committed', xp: 120,
    desc: 'Complete ten lessons.',
    check: (s) => Object.keys(s.lessonsCompleted).length >= 10,
  },
  {
    id: 'first-academy', icon: 'Trophy', title: 'Academy Graduate', xp: 160,
    desc: 'Complete an entire academy.',
    check: (s, h) => h.anyAcademyComplete(),
  },
  {
    id: 'reflective', icon: 'PenLine', title: 'Reflective Practitioner', xp: 70,
    desc: 'Write your first journal reflection.',
    check: (s) => s.journal.length >= 1,
  },
  {
    id: 'level-five', icon: 'Star', title: 'Rising Star', xp: 0,
    desc: 'Reach Level 5 — Storyteller.',
    check: (s, h) => h.level >= 5,
  },
]

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]))
