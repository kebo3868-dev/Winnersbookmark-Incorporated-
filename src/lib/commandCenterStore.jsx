import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { appDefaults } from './commandCenterData';

const KEY = 'keith-command-center-v1';
const Ctx = createContext(null);

export function CommandCenterProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...appDefaults, ...JSON.parse(raw) } : appDefaults;
    } catch {
      return appDefaults;
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const api = useMemo(() => ({
    state,
    setState,
    update: (key, value) => setState((s) => ({ ...s, [key]: value })),
    resetAll: () => setState(appDefaults),
  }), [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCommandCenter() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCommandCenter must be used within CommandCenterProvider');
  return ctx;
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `keith-command-center-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
