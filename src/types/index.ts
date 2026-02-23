// Core data models for the vocabulary drilling app

export type WordStatus = 'new' | 'learning' | 'learned';

export interface Word {
  id: string;
  portuguese: string;
  english: string;
  groupId: string;
  exampleSentences: { id: string; pt: string; en: string }[]; // API-generated example sentences with translations

  // Level-based spaced repetition fields
  level: number; // 0-8
  lastReviewDate: string | null; // ISO date string
  nextReviewDate: string; // ISO date string, recalculated from level

  // Statistics
  totalAttempts: number;
  totalCorrect: number;
  totalWrong: number;
  createdAt: string; // ISO date string

  // Lingvist features
  isMuted: boolean; // User has marked this word as "skip"
  status: WordStatus; // new, learning, or learned
}

export interface QueueEntry {
  wordId: string;
  sessionCorrectStreak: number;
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

// CSV import types
export interface CSVRow {
  portuguese: string;
  english: string;
}

// Supabase row types
export interface DbWord {
  id: string;
  portuguese: string;
  english: string;
  group_id: string;
  created_at: string;
}

export interface DbSentence {
  id: string;
  target_word_id: string;
  sentence_pt: string;
  sentence_en: string;
}

export interface DbUserProgress {
  id?: string;
  item_type: string;
  item_id: string;
  level: number;
  next_review_date: string;
  last_review_date: string | null;
  total_attempts: number;
  total_correct: number;
  total_wrong: number;
  is_muted: boolean;
  has_been_mastered: boolean;
}

export interface DbGroup {
  id: string;
  name: string;
  theme: string;
  is_unlocked: boolean;
  completed_sessions: number;
  accuracy: number;
  created_at: string;
}

export interface DbDrillSession {
  id: string;
  group_id: string;
  started_at: string;
  completed_at: string | null;
  accuracy: number;
  total_answers: number;
  correct_answers: number;
}

export interface DbErrorLog {
  id?: string;
  drill_type: string;
  sentence_id: string | null;
  word_id: string;
  expected_answer: string;
  user_input: string;
  is_correct: boolean;
  time_to_answer_ms: number;
  fuzzy_score: number;
  error_category: string | null;
}
