export const DEFAULT_PROFILE = {
  name: '',
  season: '',
  frustrations: '',
  ninetyDayMission: '',
  twoYearTarget: '',
  fiveYearTarget: '',
  tenYearTarget: '',
  twentyYearLegacy: '',
  coreValues: '',
  systemAreas: [],
  createdAt: null,
};

export const DEFAULT_GOALS = {
  ninetyDay: '',
  twoYear: '',
  fiveYear: '',
  tenYear: '',
  twentyYear: '',
  monthlyTarget: '',
  weeklyWin: '',
};

export const DEFAULT_MORNING = {
  gratitude1: '',
  gratitude2: '',
  gratitude3: '',
  personAppreciated: '',
  opportunity: '',
  whyGratitudeMatters: '',
  priorities: ['', '', ''],
  boldMove: '',
  completed: false,
};

export const DEFAULT_EVENING = {
  whatGotDone: '',
  whatWasAvoided: '',
  lessonLearned: '',
  emotionalCheckIn: '',
  tomorrowAdjustment: '',
  sentenceToFutureSelf: '',
  scores: {
    focus: 5,
    discipline: 5,
    courage: 5,
    health: 5,
    output: 5,
    alignment: 5,
    peace: 5,
  },
  alignmentScore: 5,
  completed: false,
};

export const DEFAULT_THOUGHT = {
  id: '',
  date: '',
  feeling: '',
  mentalSpace: '',
  realIssue: '',
  truthAvoiding: '',
  decisionNeeded: '',
};

export const DEFAULT_BRAINSTORM = {
  id: '',
  date: '',
  title: '',
  details: '',
  category: '',
  tags: [],
  priority: 'medium',
  nextAction: '',
  status: 'captured',
  dueDate: '',
};

export const DEFAULT_SYSTEM = {
  id: '',
  name: '',
  area: '',
  purpose: '',
  desiredOutcome: '',
  trigger: '',
  routine: '',
  trackingMetric: '',
  obstacles: '',
  resetProtocol: '',
  reviewCadence: 'weekly',
  active: true,
  createdAt: '',
};

export const DEFAULT_REVIEW = {
  id: '',
  type: 'daily',
  date: '',
  content: {},
  createdAt: '',
};
