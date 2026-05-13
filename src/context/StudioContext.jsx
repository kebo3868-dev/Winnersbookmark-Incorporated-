import { createContext, useContext, useEffect, useMemo, useReducer, useCallback } from 'react';
import { loadStore, saveStore } from '../lib/storage';
import { uid } from '../lib/ids';
import { PUBLISHING_CHECKLIST } from '../data/options';

const StudioCtx = createContext(null);

const emptyWorld = {
  location: '', period: '', culture: '', tech: '', rules: '',
  environment: '', mood: '', palette: '', landmarks: '', conflict: '',
  danger: '', description: '',
};

const emptyCover = {
  title: '', subtitle: '', issue: '1', hero: '', villainPresence: '',
  background: '', pose: '', tagline: '', publisher: 'Winnersbookmark Incorporated',
  palette: '', typography: '', coverStyle: 'marvel-action', blurb: '',
};

export function newProject(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: uid('proj'),
    title: 'Untitled Comic',
    genre: '',
    audience: '',
    style: '',
    tone: '',
    visualStyle: '',
    pages: 8,
    panelsPerPage: 5,
    mainCharacter: '',
    villain: '',
    setting: '',
    storyGoal: '',
    framework: 'three-act',

    // Story Engine
    logline: '', premise: '', heroJourney: '', villainMotivation: '',
    supportingCharacters: '', conflict: '', stakes: '', emotionalArc: '',
    plotTwist: '', ending: '', sequelHook: '',
    beats: {}, // { [beatId]: 'text' }

    characters: [],
    world: { ...emptyWorld },
    pagesList: [],
    cover: { ...emptyCover },
    publishingChecklist: PUBLISHING_CHECKLIST.map(label => ({ label, done: false })),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function newCharacter(overrides = {}) {
  return {
    id: uid('char'),
    name: '', age: '', role: '', personality: '', powers: '', weakness: '',
    backstory: '', motivation: '', costume: '', weapon: '',
    face: '', body: '', palette: '', voice: '',
    consistencyNotes: '', portraitPrompt: '',
    ...overrides,
  };
}

export function newPage(number, panelCount = 5) {
  return {
    id: uid('page'),
    number,
    summary: '',
    panels: Array.from({ length: panelCount }, (_, i) => newPanel(i + 1)),
  };
}

export function newPanel(number) {
  return {
    id: uid('panel'),
    number,
    cameraAngle: '', lighting: '',
    action: '', background: '',
    dialogue: '', captions: '', sfx: '',
    emotion: '',
    prompt: '', negative: '',
    continuity: '',
  };
}

const initialState = {
  projects: [],
  activeId: null,
  settings: {
    creatorName: '',
    publisherMark: 'Winnersbookmark Incorporated',
  },
};

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload };
    case 'CREATE_PROJECT': {
      const p = action.project;
      return { ...state, projects: [p, ...state.projects], activeId: p.id };
    }
    case 'UPDATE_PROJECT': {
      const projects = state.projects.map(p =>
        p.id === action.id ? { ...p, ...action.patch, updatedAt: new Date().toISOString() } : p
      );
      return { ...state, projects };
    }
    case 'REPLACE_PROJECT': {
      const projects = state.projects.map(p =>
        p.id === action.project.id ? { ...action.project, updatedAt: new Date().toISOString() } : p
      );
      return { ...state, projects };
    }
    case 'DELETE_PROJECT': {
      const projects = state.projects.filter(p => p.id !== action.id);
      const activeId = state.activeId === action.id ? (projects[0]?.id || null) : state.activeId;
      return { ...state, projects, activeId };
    }
    case 'SET_ACTIVE':
      return { ...state, activeId: action.id };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'CLEAR':
      return { ...initialState };
    default:
      return state;
  }
}

export function StudioProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // hydrate from localStorage on mount
  useEffect(() => {
    const data = loadStore();
    if (data) dispatch({ type: 'HYDRATE', payload: data });
  }, []);

  // persist on change
  useEffect(() => {
    saveStore({ projects: state.projects, activeId: state.activeId, settings: state.settings });
  }, [state]);

  const activeProject = useMemo(
    () => state.projects.find(p => p.id === state.activeId) || null,
    [state.projects, state.activeId]
  );

  const createProject = useCallback((overrides = {}) => {
    const p = newProject(overrides);
    dispatch({ type: 'CREATE_PROJECT', project: p });
    return p;
  }, []);

  const updateProject = useCallback((id, patch) => {
    dispatch({ type: 'UPDATE_PROJECT', id, patch });
  }, []);

  const updateActive = useCallback((patch) => {
    if (!state.activeId) return;
    dispatch({ type: 'UPDATE_PROJECT', id: state.activeId, patch });
  }, [state.activeId]);

  const replaceProject = useCallback((project) => {
    dispatch({ type: 'REPLACE_PROJECT', project });
  }, []);

  const deleteProject = useCallback((id) => {
    dispatch({ type: 'DELETE_PROJECT', id });
  }, []);

  const setActive = useCallback((id) => {
    dispatch({ type: 'SET_ACTIVE', id });
  }, []);

  const updateSettings = useCallback((patch) => {
    dispatch({ type: 'UPDATE_SETTINGS', patch });
  }, []);

  const clearAll = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const value = {
    ...state,
    activeProject,
    createProject,
    updateProject,
    updateActive,
    replaceProject,
    deleteProject,
    setActive,
    updateSettings,
    clearAll,
  };

  return <StudioCtx.Provider value={value}>{children}</StudioCtx.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioCtx);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}

// Compute high-level project progress %
export function projectProgress(p) {
  if (!p) return 0;
  const checks = [
    !!p.title,
    !!p.genre,
    !!p.style,
    !!p.logline,
    (p.characters || []).length > 0,
    !!(p.world && p.world.location),
    (p.pagesList || []).length > 0,
    !!(p.cover && p.cover.title),
    !!p.conflict,
    (p.publishingChecklist || []).some(c => c.done),
  ];
  const score = checks.filter(Boolean).length;
  return Math.round((score / checks.length) * 100);
}
