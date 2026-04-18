import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../data/storage';
import { generateSeedData } from '../data/seed';
import {
  uuid, today, thisMonth, nextDueDate,
  totalBalance, monthlyIncome, monthlyExpenses,
  upcomingSubscriptions, upcomingBills, generateAlerts,
  cashFlowForecast, subscriptionMonthlyTotal,
} from '../lib/finance';

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const [loading, setLoading]           = useState(true);
  const [profile, setProfileState]      = useState(null);
  const [onboarded, setOnboardedState]  = useState(false);
  const [accounts, setAccountsState]    = useState([]);
  const [income, setIncomeState]        = useState([]);
  const [expenses, setExpensesState]    = useState([]);
  const [subscriptions, setSubsState]   = useState([]);
  const [bills, setBillsState]          = useState([]);
  const [budgets, setBudgetsState]      = useState([]);
  const [goals, setGoalsState]          = useState([]);
  const [notifications, setNotifsState] = useState([]);

  useEffect(() => {
    setProfileState(storage.getProfile());
    setOnboardedState(storage.isOnboarded());
    setAccountsState(storage.getAccounts());
    setIncomeState(storage.getIncome());
    setExpensesState(storage.getExpenses());
    setSubsState(storage.getSubscriptions());
    setBillsState(storage.getBills());
    setBudgetsState(storage.getBudgets());
    setGoalsState(storage.getGoals());
    setNotifsState(storage.getNotifications());
    setLoading(false);
  }, []);

  // ─── Setters with persistence ───────────────────────────────────────────────
  const setProfile = useCallback((v) => { setProfileState(v); storage.setProfile(v); }, []);
  const setOnboarded = useCallback((v) => { setOnboardedState(v); storage.setOnboarded(v); }, []);

  const setAccounts = useCallback((v) => {
    const next = typeof v === 'function' ? v(storage.getAccounts()) : v;
    setAccountsState(next); storage.setAccounts(next);
  }, []);

  const setIncome = useCallback((v) => {
    const next = typeof v === 'function' ? v(storage.getIncome()) : v;
    setIncomeState(next); storage.setIncome(next);
  }, []);

  const setExpenses = useCallback((v) => {
    const next = typeof v === 'function' ? v(storage.getExpenses()) : v;
    setExpensesState(next); storage.setExpenses(next);
  }, []);

  const setSubscriptions = useCallback((v) => {
    const next = typeof v === 'function' ? v(storage.getSubscriptions()) : v;
    setSubsState(next); storage.setSubscriptions(next);
  }, []);

  const setBills = useCallback((v) => {
    const next = typeof v === 'function' ? v(storage.getBills()) : v;
    setBillsState(next); storage.setBills(next);
  }, []);

  const setBudgets = useCallback((v) => {
    const next = typeof v === 'function' ? v(storage.getBudgets()) : v;
    setBudgetsState(next); storage.setBudgets(next);
  }, []);

  const setGoals = useCallback((v) => {
    const next = typeof v === 'function' ? v(storage.getGoals()) : v;
    setGoalsState(next); storage.setGoals(next);
  }, []);

  const setNotifications = useCallback((v) => {
    const next = typeof v === 'function' ? v(storage.getNotifications()) : v;
    setNotifsState(next); storage.setNotifications(next);
  }, []);

  // ─── Account CRUD ───────────────────────────────────────────────────────────
  const addAccount = useCallback((data) => {
    const item = { ...data, id: uuid(), created_at: today(), updated_at: today() };
    setAccounts(prev => [item, ...prev]);
    return item;
  }, [setAccounts]);

  const updateAccount = useCallback((id, data) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...data, updated_at: today() } : a));
  }, [setAccounts]);

  const deleteAccount = useCallback((id) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
  }, [setAccounts]);

  // ─── Income CRUD ────────────────────────────────────────────────────────────
  const addIncome = useCallback((data) => {
    const item = { ...data, id: uuid(), created_at: today() };
    setIncome(prev => [item, ...prev]);
    return item;
  }, [setIncome]);

  const updateIncome = useCallback((id, data) => {
    setIncome(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
  }, [setIncome]);

  const deleteIncome = useCallback((id) => {
    setIncome(prev => prev.filter(i => i.id !== id));
  }, [setIncome]);

  // ─── Expense CRUD ───────────────────────────────────────────────────────────
  const addExpense = useCallback((data) => {
    const item = { ...data, id: uuid(), created_at: today() };
    setExpenses(prev => [item, ...prev]);
    return item;
  }, [setExpenses]);

  const updateExpense = useCallback((id, data) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  }, [setExpenses]);

  const deleteExpense = useCallback((id) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  }, [setExpenses]);

  // ─── Subscription CRUD ──────────────────────────────────────────────────────
  const addSubscription = useCallback((data) => {
    const item = {
      ...data,
      id: uuid(),
      next_due_date: data.next_due_date || nextDueDate(data.next_due_date, data.billing_cycle),
      is_active: true,
      created_at: today(),
    };
    setSubscriptions(prev => [item, ...prev]);
    return item;
  }, [setSubscriptions]);

  const updateSubscription = useCallback((id, data) => {
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  }, [setSubscriptions]);

  const deleteSubscription = useCallback((id) => {
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  }, [setSubscriptions]);

  // ─── Bill CRUD ──────────────────────────────────────────────────────────────
  const addBill = useCallback((data) => {
    const item = { ...data, id: uuid(), status: 'unpaid', created_at: today() };
    setBills(prev => [item, ...prev]);
    return item;
  }, [setBills]);

  const updateBill = useCallback((id, data) => {
    setBills(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
  }, [setBills]);

  const markBillPaid = useCallback((id) => {
    setBills(prev => prev.map(b => {
      if (b.id !== id) return b;
      const nextDue = b.recurrence !== 'once'
        ? nextDueDate(b.due_date, b.recurrence)
        : b.due_date;
      return { ...b, status: 'paid', paid_date: today(), next_due_date: nextDue };
    }));
  }, [setBills]);

  const deleteBill = useCallback((id) => {
    setBills(prev => prev.filter(b => b.id !== id));
  }, [setBills]);

  // ─── Budget CRUD ────────────────────────────────────────────────────────────
  const getOrCreateBudget = useCallback((month) => {
    const existing = budgets.find(b => b.month === month);
    if (existing) return existing;
    const newBudget = { id: uuid(), month, total_budget: 0, planned_income: 0, categories: [], created_at: today() };
    setBudgets(prev => [newBudget, ...prev]);
    return newBudget;
  }, [budgets, setBudgets]);

  const updateBudget = useCallback((id, data) => {
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
  }, [setBudgets]);

  // ─── Goal CRUD ──────────────────────────────────────────────────────────────
  const addGoal = useCallback((data) => {
    const item = { ...data, id: uuid(), current_amount: data.current_amount || 0, created_at: today() };
    setGoals(prev => [item, ...prev]);
    return item;
  }, [setGoals]);

  const updateGoal = useCallback((id, data) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...data } : g));
  }, [setGoals]);

  const deleteGoal = useCallback((id) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  }, [setGoals]);

  // ─── Seed data ──────────────────────────────────────────────────────────────
  const loadSeedData = useCallback(() => {
    const seed = generateSeedData();
    setAccounts(seed.accounts);
    setIncome(seed.income);
    setExpenses(seed.expenses);
    setSubscriptions(seed.subscriptions);
    setBills(seed.bills);
    setBudgets(seed.budgets);
    setGoals(seed.goals);
  }, [setAccounts, setIncome, setExpenses, setSubscriptions, setBills, setBudgets, setGoals]);

  // ─── Derived / computed ──────────────────────────────────────────────────────
  const month = thisMonth();
  const balance = totalBalance(accounts);
  const thisMonthIncome = monthlyIncome(income, month);
  const thisMonthExpenses = monthlyExpenses(expenses, month);
  const netFlow = thisMonthIncome - thisMonthExpenses;
  const upcoming = upcomingBills(bills, 14).concat(upcomingSubscriptions(subscriptions, 14))
    .sort((a, b) => (a._daysUntil ?? 99) - (b._daysUntil ?? 99));
  const alerts = generateAlerts(
    accounts, subscriptions, bills,
    budgets.find(b => b.month === month)?.categories || [],
    expenses,
  );
  const subMonthlyTotal = subscriptionMonthlyTotal(subscriptions);
  const forecast = cashFlowForecast(accounts, income, subscriptions, bills, 30);
  const unreadNotifs = notifications.filter(n => !n.is_read).length;

  const value = {
    loading,
    profile, setProfile,
    onboarded, setOnboarded,
    accounts, addAccount, updateAccount, deleteAccount,
    income, addIncome, updateIncome, deleteIncome,
    expenses, addExpense, updateExpense, deleteExpense,
    subscriptions, addSubscription, updateSubscription, deleteSubscription,
    bills, addBill, updateBill, markBillPaid, deleteBill,
    budgets, getOrCreateBudget, updateBudget,
    goals, addGoal, updateGoal, deleteGoal,
    notifications, setNotifications,
    loadSeedData,
    // Derived
    month, balance, thisMonthIncome, thisMonthExpenses, netFlow,
    upcoming, alerts, subMonthlyTotal, forecast, unreadNotifs,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
