const K = {
  profile:       'wbf_profile',
  onboarded:     'wbf_onboarded',
  accounts:      'wbf_accounts',
  income:        'wbf_income',
  expenses:      'wbf_expenses',
  subscriptions: 'wbf_subscriptions',
  bills:         'wbf_bills',
  budgets:       'wbf_budgets',
  goals:         'wbf_goals',
  notifications: 'wbf_notifications',
};

function get(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function set(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export const storage = {
  getProfile:         () => get(K.profile),
  setProfile:         (v) => set(K.profile, v),
  isOnboarded:        () => get(K.onboarded, false) === true,
  setOnboarded:       (v) => set(K.onboarded, v),
  getAccounts:        () => get(K.accounts, []),
  setAccounts:        (v) => set(K.accounts, v),
  getIncome:          () => get(K.income, []),
  setIncome:          (v) => set(K.income, v),
  getExpenses:        () => get(K.expenses, []),
  setExpenses:        (v) => set(K.expenses, v),
  getSubscriptions:   () => get(K.subscriptions, []),
  setSubscriptions:   (v) => set(K.subscriptions, v),
  getBills:           () => get(K.bills, []),
  setBills:           (v) => set(K.bills, v),
  getBudgets:         () => get(K.budgets, []),
  setBudgets:         (v) => set(K.budgets, v),
  getGoals:           () => get(K.goals, []),
  setGoals:           (v) => set(K.goals, v),
  getNotifications:   () => get(K.notifications, []),
  setNotifications:   (v) => set(K.notifications, v),
  clearAll: () => Object.values(K).forEach(k => localStorage.removeItem(k)),
};

export default storage;
