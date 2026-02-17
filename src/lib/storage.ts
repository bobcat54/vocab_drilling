// localStorage abstraction layer for persisting app data

import type { Word, WordGroup, DrillSession, AppState } from '@/types';

const STORAGE_KEYS = {
  WORDS: 'vocab_app_words',
  GROUPS: 'vocab_app_groups',
  SESSIONS: 'vocab_app_sessions',
  APP_STATE: 'vocab_app_state',
} as const;

// Helper to check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

// Words
export function getWords(): Word[] {
  if (!isBrowser) return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WORDS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading words from localStorage:', error);
    return [];
  }
}

export function saveWords(words: Word[]): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEYS.WORDS, JSON.stringify(words));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded. Consider clearing old data.');
      // TODO: Implement cleanup strategy
    } else {
      console.error('Error saving words to localStorage:', error);
    }
  }
}

// Groups
export function getGroups(): WordGroup[] {
  if (!isBrowser) return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GROUPS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading groups from localStorage:', error);
    return [];
  }
}

export function saveGroups(groups: WordGroup[]): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
  } catch (error) {
    console.error('Error saving groups to localStorage:', error);
  }
}

// Sessions
export function getSessions(): DrillSession[] {
  if (!isBrowser) return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading sessions from localStorage:', error);
    return [];
  }
}

export function saveSessions(sessions: DrillSession[]): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving sessions to localStorage:', error);
  }
}

// App State
export function getAppState(): AppState {
  if (!isBrowser) {
    return getDefaultAppState();
  }
  try {
    const data = localStorage.getItem(STORAGE_KEYS.APP_STATE);
    return data ? JSON.parse(data) : getDefaultAppState();
  } catch (error) {
    console.error('Error reading app state from localStorage:', error);
    return getDefaultAppState();
  }
}

export function saveAppState(state: AppState): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving app state to localStorage:', error);
  }
}

function getDefaultAppState(): AppState {
  return {
    currentGroupId: null,
    completedGroupIds: [],
    totalWordsLearned: 0,
    overallAccuracy: 0,
    theme: 'light',
    lastUpdated: new Date().toISOString(),
    dailyStreak: 0,
    lastSessionDate: null,
    sessionGoal: 50,
  };
}

// Utility to clear all app data
export function clearAllData(): void {
  if (!isBrowser) return;
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}
