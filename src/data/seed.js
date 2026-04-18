import { uuid, today, addDays, addMonths } from '../lib/finance';

const t = today();

export function generateSeedData() {
  const accounts = [
    { id: uuid(), name: 'Chase Checking', type: 'checking', institution_name: 'Chase', current_balance: 3842.17, available_balance: 3642.17, currency: 'USD', is_manual: true, created_at: t },
    { id: uuid(), name: 'Marcus Savings', type: 'savings', institution_name: 'Goldman Sachs', current_balance: 12500.00, available_balance: 12500.00, currency: 'USD', is_manual: true, created_at: t },
    { id: uuid(), name: 'Chase Sapphire', type: 'credit', institution_name: 'Chase', current_balance: 1240.85, available_balance: null, currency: 'USD', is_manual: true, created_at: t },
  ];

  const income = [
    { id: uuid(), source_name: 'Employer — Salary', amount: 5200, frequency: 'biweekly', received_date: addDays(t, -5), is_recurring: true, next_expected_date: addDays(t, 9), category: 'Salary', notes: '' },
    { id: uuid(), source_name: 'Freelance Design', amount: 850, frequency: 'monthly', received_date: addDays(t, -12), is_recurring: false, next_expected_date: null, category: 'Freelance', notes: '' },
    { id: uuid(), source_name: 'Employer — Salary', amount: 5200, frequency: 'biweekly', received_date: addDays(t, -19), is_recurring: true, next_expected_date: null, category: 'Salary', notes: '' },
  ];

  const expenses = [
    { id: uuid(), account_id: null, name: 'Whole Foods', amount: 142.30, category: 'Food & Grocery', transaction_date: addDays(t, -2), is_recurring: false, notes: '' },
    { id: uuid(), account_id: null, name: 'Uber', amount: 18.50, category: 'Transportation', transaction_date: addDays(t, -3), is_recurring: false, notes: '' },
    { id: uuid(), account_id: null, name: 'Chipotle', amount: 13.75, category: 'Dining Out', transaction_date: addDays(t, -4), is_recurring: false, notes: '' },
    { id: uuid(), account_id: null, name: 'Amazon', amount: 67.99, category: 'Shopping', transaction_date: addDays(t, -5), is_recurring: false, notes: '' },
    { id: uuid(), account_id: null, name: 'CVS Pharmacy', amount: 24.15, category: 'Health', transaction_date: addDays(t, -6), is_recurring: false, notes: '' },
    { id: uuid(), account_id: null, name: 'Target', amount: 89.43, category: 'Shopping', transaction_date: addDays(t, -8), is_recurring: false, notes: '' },
    { id: uuid(), account_id: null, name: 'Starbucks', amount: 7.25, category: 'Dining Out', transaction_date: addDays(t, -1), is_recurring: false, notes: '' },
    { id: uuid(), account_id: null, name: 'Gas Station', amount: 52.10, category: 'Transportation', transaction_date: addDays(t, -9), is_recurring: false, notes: '' },
  ];

  const subscriptions = [
    { id: uuid(), name: 'Netflix', amount: 15.49, currency: 'USD', billing_cycle: 'monthly', next_due_date: addDays(t, 3), category: 'Entertainment', is_active: true, notes: '' },
    { id: uuid(), name: 'Spotify', amount: 10.99, currency: 'USD', billing_cycle: 'monthly', next_due_date: addDays(t, 7), category: 'Entertainment', is_active: true, notes: '' },
    { id: uuid(), name: 'Apple iCloud', amount: 2.99, currency: 'USD', billing_cycle: 'monthly', next_due_date: addDays(t, 12), category: 'Utilities', is_active: true, notes: '' },
    { id: uuid(), name: 'ChatGPT Plus', amount: 20.00, currency: 'USD', billing_cycle: 'monthly', next_due_date: addDays(t, 15), category: 'Productivity', is_active: true, notes: '' },
    { id: uuid(), name: 'Adobe CC', amount: 54.99, currency: 'USD', billing_cycle: 'monthly', next_due_date: addDays(t, 18), category: 'Productivity', is_active: true, notes: '' },
    { id: uuid(), name: 'Gym Membership', amount: 45.00, currency: 'USD', billing_cycle: 'monthly', next_due_date: addDays(t, 5), category: 'Health', is_active: true, notes: '' },
    { id: uuid(), name: 'Amazon Prime', amount: 139.00, currency: 'USD', billing_cycle: 'annual', next_due_date: addMonths(t, 3), category: 'Shopping', is_active: true, notes: '' },
  ];

  const bills = [
    { id: uuid(), name: 'Rent', amount: 2100.00, due_date: addDays(t, 8), recurrence: 'monthly', category: 'Housing', autopay_enabled: false, status: 'unpaid', notes: '' },
    { id: uuid(), name: 'Electric Bill', amount: 94.20, due_date: addDays(t, 11), recurrence: 'monthly', category: 'Utilities', autopay_enabled: true, status: 'unpaid', notes: '' },
    { id: uuid(), name: 'Internet', amount: 69.99, due_date: addDays(t, 2), recurrence: 'monthly', category: 'Utilities', autopay_enabled: true, status: 'unpaid', notes: '' },
    { id: uuid(), name: 'Phone Bill', amount: 85.00, due_date: addDays(t, 14), recurrence: 'monthly', category: 'Utilities', autopay_enabled: false, status: 'unpaid', notes: '' },
    { id: uuid(), name: 'Car Insurance', amount: 148.00, due_date: addDays(t, 20), recurrence: 'monthly', category: 'Insurance', autopay_enabled: true, status: 'unpaid', notes: '' },
  ];

  const budgets = [
    {
      id: uuid(),
      month: today().slice(0, 7),
      total_budget: 6000,
      planned_income: 5200,
      created_at: t,
      categories: [
        { id: uuid(), category_name: 'Housing', allocated_amount: 2100 },
        { id: uuid(), category_name: 'Food & Grocery', allocated_amount: 600 },
        { id: uuid(), category_name: 'Dining Out', allocated_amount: 200 },
        { id: uuid(), category_name: 'Transportation', allocated_amount: 300 },
        { id: uuid(), category_name: 'Shopping', allocated_amount: 300 },
        { id: uuid(), category_name: 'Utilities', allocated_amount: 350 },
        { id: uuid(), category_name: 'Health', allocated_amount: 150 },
        { id: uuid(), category_name: 'Entertainment', allocated_amount: 100 },
        { id: uuid(), category_name: 'Savings', allocated_amount: 500 },
      ],
    },
  ];

  const goals = [
    { id: uuid(), name: 'Emergency Fund', target_amount: 15000, current_amount: 12500, target_date: addMonths(t, 4), recurring_contribution: 650, created_at: t, notes: '' },
    { id: uuid(), name: 'Vacation — Italy', target_amount: 5000, current_amount: 1200, target_date: addMonths(t, 8), recurring_contribution: 450, created_at: t, notes: '' },
    { id: uuid(), name: 'New Laptop', target_amount: 2500, current_amount: 875, target_date: addMonths(t, 5), recurring_contribution: 300, created_at: t, notes: '' },
  ];

  return { accounts, income, expenses, subscriptions, bills, budgets, goals };
}
