// ─── Date helpers ────────────────────────────────────────────────────────────

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function monthKey(dateStr) {
  return String(dateStr).slice(0, 7);
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + 'T00:00:00') - new Date(new Date().toDateString());
  return Math.round(diff / 86400000);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export function addWeeks(dateStr, n) {
  return addDays(dateStr, n * 7);
}

export function addYears(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

export function startOfMonth(monthStr) {
  return monthStr + '-01';
}

export function endOfMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

export function daysInMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function daysPassed(monthStr) {
  const todayStr = today();
  if (monthKey(todayStr) !== monthStr) {
    if (todayStr > endOfMonth(monthStr)) return daysInMonth(monthStr);
    return 0;
  }
  return new Date().getDate();
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatCurrency(amount, currency = 'USD', compact = false) {
  if (amount === null || amount === undefined) return '$0';
  const num = Number(amount);
  if (compact && Math.abs(num) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1,
    }).format(num);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

export function formatMonth(monthStr) {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ─── Recurring date logic ─────────────────────────────────────────────────────

export function nextDueDate(currentDueDate, cycle) {
  if (!currentDueDate) return today();
  const t = today();
  let next = currentDueDate;
  let iterations = 0;
  while (next <= t && iterations < 500) {
    next = advanceByCycle(next, cycle);
    iterations++;
  }
  return next;
}

function advanceByCycle(dateStr, cycle) {
  switch (cycle) {
    case 'weekly':    return addWeeks(dateStr, 1);
    case 'biweekly':  return addWeeks(dateStr, 2);
    case 'monthly':   return addMonths(dateStr, 1);
    case 'quarterly': return addMonths(dateStr, 3);
    case 'biannual':  return addMonths(dateStr, 6);
    case 'annual':    return addYears(dateStr, 1);
    default:          return addMonths(dateStr, 1);
  }
}

export function monthlyEquivalent(amount, cycle) {
  const a = Number(amount) || 0;
  switch (cycle) {
    case 'weekly':    return a * 4.33;
    case 'biweekly':  return a * 2.17;
    case 'monthly':   return a;
    case 'quarterly': return a / 3;
    case 'biannual':  return a / 6;
    case 'annual':    return a / 12;
    default:          return a;
  }
}

export function annualEquivalent(amount, cycle) {
  return monthlyEquivalent(amount, cycle) * 12;
}

// ─── Balance calculations ─────────────────────────────────────────────────────

export function totalBalance(accounts) {
  return accounts.reduce((sum, a) => {
    const bal = Number(a.current_balance) || 0;
    return a.type === 'credit' ? sum - Math.abs(bal) : sum + bal;
  }, 0);
}

export function totalAssets(accounts) {
  return accounts
    .filter(a => a.type !== 'credit')
    .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
}

export function totalDebt(accounts) {
  return accounts
    .filter(a => a.type === 'credit')
    .reduce((sum, a) => sum + Math.abs(Number(a.current_balance) || 0), 0);
}

// ─── Income & expense summaries ───────────────────────────────────────────────

export function monthlyIncome(incomeItems, month) {
  return incomeItems
    .filter(i => monthKey(i.received_date) === month)
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

export function monthlyExpenses(expenseItems, month) {
  return expenseItems
    .filter(e => monthKey(e.transaction_date) === month)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

export function spendingByCategory(expenseItems, month) {
  const result = {};
  expenseItems
    .filter(e => monthKey(e.transaction_date) === month)
    .forEach(e => {
      const cat = e.category || 'Other';
      result[cat] = (result[cat] || 0) + (Number(e.amount) || 0);
    });
  return result;
}

export function incomeBySource(incomeItems, month) {
  const result = {};
  incomeItems
    .filter(i => monthKey(i.received_date) === month)
    .forEach(i => {
      const src = i.source_name || 'Unknown';
      result[src] = (result[src] || 0) + (Number(i.amount) || 0);
    });
  return result;
}

// ─── Upcoming items ───────────────────────────────────────────────────────────

export function upcomingSubscriptions(subscriptions, days = 14) {
  return subscriptions
    .filter(s => s.is_active)
    .map(s => ({ ...s, _daysUntil: daysUntil(s.next_due_date) }))
    .filter(s => s._daysUntil !== null && s._daysUntil >= 0 && s._daysUntil <= days)
    .sort((a, b) => a._daysUntil - b._daysUntil);
}

export function upcomingBills(bills, days = 14) {
  return bills
    .filter(b => b.status !== 'paid')
    .map(b => ({ ...b, _daysUntil: daysUntil(b.due_date) }))
    .filter(b => b._daysUntil !== null && b._daysUntil >= -3 && b._daysUntil <= days)
    .sort((a, b) => a._daysUntil - b._daysUntil);
}

export function overdueBills(bills) {
  return bills
    .filter(b => b.status !== 'paid' && daysUntil(b.due_date) < 0)
    .sort((a, b) => daysUntil(a.due_date) - daysUntil(b.due_date));
}

export function allUpcoming(subscriptions, bills, days = 14) {
  const subs = upcomingSubscriptions(subscriptions, days).map(s => ({
    ...s, _type: 'subscription',
  }));
  const bs = upcomingBills(bills, days).map(b => ({
    ...b, _type: 'bill',
  }));
  return [...subs, ...bs].sort((a, b) => a._daysUntil - b._daysUntil);
}

// ─── Budget logic ─────────────────────────────────────────────────────────────

export function budgetProgress(budgetCategories, expenseItems, month) {
  const spent = spendingByCategory(expenseItems, month);
  return budgetCategories.map(bc => ({
    ...bc,
    spent: spent[bc.category_name] || 0,
    remaining: Math.max(0, bc.allocated_amount - (spent[bc.category_name] || 0)),
    overspent: (spent[bc.category_name] || 0) > bc.allocated_amount,
    pct: bc.allocated_amount > 0
      ? Math.min(100, ((spent[bc.category_name] || 0) / bc.allocated_amount) * 100)
      : 0,
  }));
}

export function totalBudgetStats(budgetCategories, expenseItems, month) {
  const progress = budgetProgress(budgetCategories, expenseItems, month);
  const totalAllocated = progress.reduce((s, c) => s + c.allocated_amount, 0);
  const totalSpent = progress.reduce((s, c) => s + c.spent, 0);
  return {
    allocated: totalAllocated,
    spent: totalSpent,
    remaining: Math.max(0, totalAllocated - totalSpent),
    pct: totalAllocated > 0 ? Math.min(100, (totalSpent / totalAllocated) * 100) : 0,
    overBudget: totalSpent > totalAllocated,
  };
}

// ─── Cash flow forecast ───────────────────────────────────────────────────────

export function cashFlowForecast(accounts, incomeItems, subscriptions, bills, days = 30) {
  const currentBalance = totalBalance(accounts);
  const t = today();
  const futureDate = addDays(t, days);

  let expectedIncome = 0;
  let expectedExpenses = 0;
  const upcomingObligations = [];

  // Recurring income expected in window
  incomeItems
    .filter(i => i.is_recurring && i.next_expected_date)
    .forEach(i => {
      let d = i.next_expected_date;
      while (d >= t && d <= futureDate) {
        expectedIncome += Number(i.amount) || 0;
        d = advanceByCycle(d, i.frequency);
      }
    });

  // Subscriptions in window
  subscriptions.filter(s => s.is_active).forEach(s => {
    let d = s.next_due_date;
    while (d >= t && d <= futureDate) {
      expectedExpenses += Number(s.amount) || 0;
      upcomingObligations.push({ date: d, name: s.name, amount: Number(s.amount), type: 'subscription' });
      d = advanceByCycle(d, s.billing_cycle);
    }
  });

  // Bills in window
  bills.filter(b => b.status !== 'paid').forEach(b => {
    if (b.due_date >= t && b.due_date <= futureDate) {
      expectedExpenses += Number(b.amount) || 0;
      upcomingObligations.push({ date: b.due_date, name: b.name, amount: Number(b.amount), type: 'bill' });
    }
  });

  const projectedBalance = currentBalance + expectedIncome - expectedExpenses;
  const safeBalance = currentBalance - expectedExpenses;

  return {
    currentBalance,
    expectedIncome,
    expectedExpenses,
    projectedBalance,
    safeBalance,
    safeToSpend: Math.max(0, safeBalance - 200), // $200 buffer
    lowRisk: safeBalance < 200,
    negativeRisk: projectedBalance < 0,
    upcomingObligations: upcomingObligations.sort((a, b) => a.date.localeCompare(b.date)),
    days,
  };
}

// ─── Savings goals ────────────────────────────────────────────────────────────

export function goalProgress(goal) {
  const current = Number(goal.current_amount) || 0;
  const target = Number(goal.target_amount) || 1;
  const pct = Math.min(100, (current / target) * 100);
  const remaining = Math.max(0, target - current);

  let daysToGoal = null;
  if (goal.recurring_contribution && Number(goal.recurring_contribution) > 0) {
    const monthsNeeded = remaining / Number(goal.recurring_contribution);
    daysToGoal = Math.ceil(monthsNeeded * 30);
  }

  let onTrack = null;
  if (goal.target_date && daysToGoal !== null) {
    const dLeft = daysUntil(goal.target_date);
    onTrack = daysToGoal <= dLeft;
  }

  return { pct, remaining, daysToGoal, onTrack };
}

// ─── Subscription analytics ───────────────────────────────────────────────────

export function subscriptionMonthlyTotal(subscriptions) {
  return subscriptions
    .filter(s => s.is_active)
    .reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.billing_cycle), 0);
}

export function subscriptionAnnualTotal(subscriptions) {
  return subscriptionMonthlyTotal(subscriptions) * 12;
}

// ─── Trend data (last 6 months) ───────────────────────────────────────────────

export function last6Months() {
  const months = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(m.toISOString().slice(0, 7));
  }
  return months;
}

export function monthlyTrend(incomeItems, expenseItems) {
  return last6Months().map(month => ({
    month,
    label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
    income: monthlyIncome(incomeItems, month),
    expenses: monthlyExpenses(expenseItems, month),
    net: monthlyIncome(incomeItems, month) - monthlyExpenses(expenseItems, month),
  }));
}

// ─── Alert generation ─────────────────────────────────────────────────────────

export function generateAlerts(accounts, subscriptions, bills, budgetCategories, expenseItems) {
  const alerts = [];
  const month = thisMonth();

  const balance = totalBalance(accounts);
  if (balance < 500 && accounts.length > 0) {
    alerts.push({
      id: 'low-balance',
      type: 'warning',
      title: 'Low Balance',
      body: `Total balance is ${formatCurrency(balance)}. Review upcoming obligations.`,
      priority: balance < 100 ? 'high' : 'medium',
    });
  }

  upcomingBills(bills, 3).forEach(b => {
    alerts.push({
      id: `bill-${b.id}`,
      type: 'bill',
      title: `Bill Due ${b._daysUntil === 0 ? 'Today' : `in ${b._daysUntil}d`}`,
      body: `${b.name} — ${formatCurrency(b.amount)}`,
      priority: b._daysUntil <= 1 ? 'high' : 'medium',
    });
  });

  overdueBills(bills).forEach(b => {
    alerts.push({
      id: `overdue-${b.id}`,
      type: 'overdue',
      title: 'Overdue Bill',
      body: `${b.name} — ${formatCurrency(b.amount)} — ${Math.abs(daysUntil(b.due_date))}d overdue`,
      priority: 'high',
    });
  });

  upcomingSubscriptions(subscriptions, 3).forEach(s => {
    alerts.push({
      id: `sub-${s.id}`,
      type: 'subscription',
      title: `Subscription Due ${s._daysUntil === 0 ? 'Today' : `in ${s._daysUntil}d`}`,
      body: `${s.name} — ${formatCurrency(s.amount)}`,
      priority: 'low',
    });
  });

  if (budgetCategories.length > 0) {
    const progress = budgetProgress(budgetCategories, expenseItems, month);
    progress.filter(c => c.overspent).forEach(c => {
      alerts.push({
        id: `budget-over-${c.id}`,
        type: 'budget',
        title: 'Budget Exceeded',
        body: `${c.category_name} is over budget by ${formatCurrency(c.spent - c.allocated_amount)}`,
        priority: 'medium',
      });
    });
    progress.filter(c => !c.overspent && c.pct >= 80).forEach(c => {
      alerts.push({
        id: `budget-near-${c.id}`,
        type: 'budget',
        title: 'Budget Warning',
        body: `${c.category_name} is ${Math.round(c.pct)}% spent`,
        priority: 'low',
      });
    });
  }

  return alerts.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  });
}

// ─── Calendar events ──────────────────────────────────────────────────────────

export function calendarEvents(subscriptions, bills, incomeItems, days = 45) {
  const events = [];
  const t = today();
  const end = addDays(t, days);

  subscriptions.filter(s => s.is_active).forEach(s => {
    let d = s.next_due_date;
    let i = 0;
    while (d <= end && i < 20) {
      if (d >= t) {
        events.push({ date: d, type: 'subscription', name: s.name, amount: Number(s.amount), id: s.id });
      }
      d = advanceByCycle(d, s.billing_cycle);
      i++;
    }
  });

  bills.forEach(b => {
    if (b.due_date >= t && b.due_date <= end) {
      events.push({ date: b.due_date, type: 'bill', name: b.name, amount: Number(b.amount), id: b.id, status: b.status });
    }
  });

  incomeItems.filter(i => i.is_recurring && i.next_expected_date).forEach(i => {
    let d = i.next_expected_date;
    let iter = 0;
    while (d <= end && iter < 10) {
      if (d >= t) {
        events.push({ date: d, type: 'income', name: i.source_name, amount: Number(i.amount), id: i.id });
      }
      d = advanceByCycle(d, i.frequency);
      iter++;
    }
  });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function uuid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}
