// Level-based spaced repetition system
// 9 levels (0-8) with fixed day intervals between reviews

import type { Word } from '@/types';

// Days until next review for each level. Level 8 = "mastered forever" (null → far future).
export const LEVEL_INTERVALS: Record<number, number | null> = {
  0: 0,
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
  6: 60,
  7: 120,
  8: null,
};

/**
 * Calculate the next review date from a given level.
 * Level 8 returns a date far in the future (10 years).
 */
export function calculateNextReviewDate(level: number, fromDate: Date = new Date()): string {
  const interval = LEVEL_INTERVALS[level];
  const next = new Date(fromDate);

  if (interval === null) {
    // Level 8: essentially "done" — schedule far future
    next.setFullYear(next.getFullYear() + 10);
  } else {
    next.setDate(next.getDate() + interval);
  }

  return next.toISOString();
}

/** Advance a level by 1, capped at 8. */
export function advanceLevel(level: number): number {
  return Math.min(8, level + 1);
}

/** Drop a level by 2, floored at 0. */
export function dropLevel(level: number): number {
  return Math.max(0, level - 2);
}

/** Check if a word is due for review (nextReviewDate <= today). */
export function isWordDue(word: Word, currentDate: Date = new Date()): boolean {
  const nextReview = new Date(word.nextReviewDate);
  const today = new Date(currentDate);

  today.setHours(0, 0, 0, 0);
  nextReview.setHours(0, 0, 0, 0);

  return nextReview <= today;
}

/**
 * Get all due, non-muted words sorted by level ascending (lowest level first).
 */
export function getDueWords(words: Word[], currentDate: Date = new Date()): Word[] {
  return words
    .filter(w => !w.isMuted && isWordDue(w, currentDate))
    .sort((a, b) => a.level - b.level);
}

/** Default fields for a brand-new word. */
export function getDefaultLevelParams() {
  return {
    level: 0,
    lastReviewDate: null as string | null,
    nextReviewDate: new Date().toISOString(),
    totalAttempts: 0,
    totalCorrect: 0,
    totalWrong: 0,
  };
}
