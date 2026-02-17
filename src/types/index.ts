// Core data models for the vocabulary drilling app

export type WordStatus = 'new' | 'learning' | 'learned';

export interface Word {
  id: string;
  portuguese: string;
  english: string;
  groupId: string;
  exampleSentences: string[]; // API-generated example sentences

  // SM-2 spaced repetition fields
  easinessFactor: number; // 1.3-2.5, default 2.5
  interval: number; // Days until next review
  repetitions: number; // Consecutive correct answers
  nextReviewDate: string; // ISO date string

  // Statistics
  timesSeen: number;
  timesCorrect: number;
  lastReviewed: string | null; // ISO date string
  createdAt: string; // ISO date string

  // Lingvist features
  isMuted: boolean; // User has marked this word as "skip"
  status: WordStatus; // new, learning, or learned
}

export interface WordGroup {
  id: string;
  name: string; // e.g., "Food & Cooking 1"
  theme: string; // e.g., "Food & Cooking"
  wordIds: string[]; // ~15 words
  isUnlocked: boolean;
  completedSessions: number;
  accuracy: number; // 0-100
  createdAt: string; // ISO date string
}

export interface WordResult {
  wordId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  isNearMatch: boolean; // Close but not exact (e.g., missing accent)
  timestamp: string; // ISO date string
}

export interface DrillSession {
  id: string;
  groupId: string;
  startedAt: string; // ISO date string
  completedAt: string | null; // ISO date string
  wordResults: WordResult[];
  accuracy: number; // 0-100
}

export interface AppState {
  currentGroupId: string | null;
  completedGroupIds: string[];
  totalWordsLearned: number;
  overallAccuracy: number;
  theme: 'light' | 'dark';
  lastUpdated: string; // ISO date string

  // Lingvist features
  dailyStreak: number; // Consecutive days with at least 1 session
  lastSessionDate: string | null; // ISO date string (date only, not time)
  sessionGoal: number; // Default 50 cards per session
}

// SM-2 algorithm types
export interface SM2Result {
  easinessFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
}

// CSV import types
export interface CSVRow {
  portuguese: string;
  english: string;
}
