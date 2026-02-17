// SM-2 Spaced Repetition Algorithm implementation
// Based on SuperMemo 2 algorithm for optimal review scheduling

import type { Word, SM2Result } from '@/types';

/**
 * Calculate the next review parameters using the SM-2 algorithm
 *
 * @param quality - Answer quality (0-5). In our app: correct = 4, incorrect = 1
 * @param word - Current word with its SM-2 parameters
 * @returns Updated SM-2 parameters including next review date
 */
export function calculateSM2(quality: number, word: Word): SM2Result {
  let { easinessFactor, interval, repetitions } = word;

  // Quality must be 0-5
  const clampedQuality = Math.max(0, Math.min(5, quality));

  if (clampedQuality < 3) {
    // Incorrect answer - reset repetitions and review again tomorrow
    repetitions = 0;
    interval = 1;
  } else {
    // Correct answer - calculate new interval
    if (repetitions === 0) {
      interval = 1; // First correct: review in 1 day
    } else if (repetitions === 1) {
      interval = 6; // Second correct: review in 6 days
    } else {
      // Subsequent reviews: multiply by easiness factor
      interval = Math.round(interval * easinessFactor);
    }
    repetitions += 1;
  }

  // Update easiness factor based on answer quality
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const newEF = easinessFactor + (0.1 - (5 - clampedQuality) * (0.08 + (5 - clampedQuality) * 0.02));

  // Easiness factor must be at least 1.3
  easinessFactor = Math.max(1.3, newEF);

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return {
    easinessFactor,
    interval,
    repetitions,
    nextReviewDate,
  };
}

/**
 * Map answer correctness to SM-2 quality score
 *
 * @param isCorrect - Whether the answer was correct
 * @returns Quality score (1-5, where 4 = correct, 1 = incorrect)
 */
export function getQualityScore(isCorrect: boolean): number {
  return isCorrect ? 4 : 1;
}

/**
 * Check if a word is due for review
 *
 * @param word - Word to check
 * @param currentDate - Current date (defaults to now)
 * @returns True if the word should be reviewed today
 */
export function isWordDue(word: Word, currentDate: Date = new Date()): boolean {
  const nextReview = new Date(word.nextReviewDate);
  const today = new Date(currentDate);

  // Set both to start of day for comparison
  today.setHours(0, 0, 0, 0);
  nextReview.setHours(0, 0, 0, 0);

  return nextReview <= today;
}

/**
 * Get all due words from a list
 *
 * @param words - Array of words to filter
 * @param currentDate - Current date (defaults to now)
 * @returns Array of words that are due for review
 */
export function getDueWords(words: Word[], currentDate: Date = new Date()): Word[] {
  return words.filter(word => isWordDue(word, currentDate));
}

/**
 * Initialize SM-2 parameters for a new word
 *
 * @returns Default SM-2 parameters for a new word
 */
export function getDefaultSM2Params() {
  return {
    easinessFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date().toISOString(),
  };
}
