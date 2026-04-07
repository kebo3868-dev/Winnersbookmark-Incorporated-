const STORAGE_KEYS = {
  PROFILE: 'wbd_profile',
  ONBOARDED: 'wbd_onboarded',
  ENTRIES: 'wbd_entries',
  GOALS: 'wbd_goals',
  SYSTEMS: 'wbd_systems',
  BRAINSTORMS: 'wbd_brainstorms',
  THOUGHTS: 'wbd_thoughts',
  REVIEWS: 'wbd_reviews',
};

function get(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

export const storage = {
  getProfile: () => get(STORAGE_KEYS.PROFILE),
  setProfile: (profile) => set(STORAGE_KEYS.PROFILE, profile),

  isOnboarded: () => get(STORAGE_KEYS.ONBOARDED) === true,
  setOnboarded: (val) => set(STORAGE_KEYS.ONBOARDED, val),

  getEntries: () => get(STORAGE_KEYS.ENTRIES) || {},
  getEntry: (dateKey) => {
    const entries = get(STORAGE_KEYS.ENTRIES) || {};
    return entries[dateKey] || null;
  },
  setEntry: (dateKey, entry) => {
    const entries = get(STORAGE_KEYS.ENTRIES) || {};
    entries[dateKey] = { ...entries[dateKey], ...entry };
    set(STORAGE_KEYS.ENTRIES, entries);
  },

  getGoals: () => get(STORAGE_KEYS.GOALS) || {
    ninetyDay: '', twoYear: '', fiveYear: '', tenYear: '', twentyYear: '',
    monthlyTarget: '', weeklyWin: '',
  },
  setGoals: (goals) => set(STORAGE_KEYS.GOALS, goals),

  getSystems: () => get(STORAGE_KEYS.SYSTEMS) || [],
  setSystems: (systems) => set(STORAGE_KEYS.SYSTEMS, systems),

  getBrainstorms: () => get(STORAGE_KEYS.BRAINSTORMS) || [],
  setBrainstorms: (items) => set(STORAGE_KEYS.BRAINSTORMS, items),

  getThoughts: () => get(STORAGE_KEYS.THOUGHTS) || [],
  setThoughts: (thoughts) => set(STORAGE_KEYS.THOUGHTS, thoughts),

  getReviews: () => get(STORAGE_KEYS.REVIEWS) || [],
  setReviews: (reviews) => set(STORAGE_KEYS.REVIEWS, reviews),

  clearAll: () => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }
};

export default storage;
