// Session queue system for intra-session word scheduling
// Words are reinserted at calculated positions based on correctness/streak.
// A word is "mastered" (removed) when it reaches a streak of 4 correct in a row.

import type { Word, QueueEntry } from '@/types';

/**
 * Build the initial session queue with a new-word throttle.
 * "New" words (totalAttempts === 0) are limited to at most 5 in a row,
 * then a review word is forced before more new words appear.
 */
export function buildInitialQueue(words: Word[], sessionGoal: number): QueueEntry[] {
  const limited = words.slice(0, sessionGoal);
  const newWords = limited.filter(w => w.totalAttempts === 0);
  const reviewWords = limited.filter(w => w.totalAttempts > 0);

  const queue: QueueEntry[] = [];
  let newIdx = 0;
  let revIdx = 0;
  let consecutiveNew = 0;

  while (newIdx < newWords.length || revIdx < reviewWords.length) {
    // If we've had 5 new words in a row and there are review words left, force a review word
    if (consecutiveNew >= 5 && revIdx < reviewWords.length) {
      queue.push({ wordId: reviewWords[revIdx].id, sessionCorrectStreak: 0 });
      revIdx++;
      consecutiveNew = 0;
    } else if (newIdx < newWords.length && revIdx < reviewWords.length) {
      // Interleave: take from whichever source is next in the original order
      // Prefer the original ordering — new words first (they're sorted by level asc from getDueWords)
      queue.push({ wordId: newWords[newIdx].id, sessionCorrectStreak: 0 });
      newIdx++;
      consecutiveNew++;
    } else if (newIdx < newWords.length) {
      queue.push({ wordId: newWords[newIdx].id, sessionCorrectStreak: 0 });
      newIdx++;
      consecutiveNew++;
    } else {
      queue.push({ wordId: reviewWords[revIdx].id, sessionCorrectStreak: 0 });
      revIdx++;
      consecutiveNew = 0;
    }
  }

  return queue;
}

/** Calculate reinsert position for a correct answer based on new streak. */
export function getCorrectReinsertPosition(newStreak: number, queueLength: number): number {
  let target: number;
  if (newStreak === 1) {
    target = 5 + Math.floor(Math.random() * 2); // 5-6
  } else if (newStreak === 2) {
    target = 10 + Math.floor(Math.random() * 3); // 10-12
  } else {
    target = 20; // streak 3
  }
  return Math.min(target, queueLength);
}

/** Calculate reinsert position for a wrong answer. */
export function getWrongReinsertPosition(queueLength: number): number {
  const target = 2 + Math.floor(Math.random() * 2); // 2-3
  return Math.min(target, queueLength);
}

export interface ProcessAnswerResult {
  newQueue: QueueEntry[];
  entry: QueueEntry;
  wasMastered: boolean;
}

/**
 * Process an answer: remove the front entry, update streak, and reinsert
 * at the appropriate position (or remove if mastered at streak 4).
 */
export function processAnswer(queue: QueueEntry[], isCorrect: boolean): ProcessAnswerResult {
  if (queue.length === 0) {
    throw new Error('Cannot process answer on empty queue');
  }

  const [front, ...rest] = queue;

  if (isCorrect) {
    const newStreak = front.sessionCorrectStreak + 1;

    if (newStreak >= 4) {
      // Mastered — remove from queue
      return { newQueue: rest, entry: { ...front, sessionCorrectStreak: newStreak }, wasMastered: true };
    }

    // Reinsert further back based on streak
    const pos = getCorrectReinsertPosition(newStreak, rest.length);
    const updatedEntry: QueueEntry = { ...front, sessionCorrectStreak: newStreak };
    const newQueue = [...rest];
    newQueue.splice(pos, 0, updatedEntry);

    return { newQueue, entry: updatedEntry, wasMastered: false };
  } else {
    // Wrong: reset streak, reinsert close to front
    const pos = getWrongReinsertPosition(rest.length);
    const updatedEntry: QueueEntry = { ...front, sessionCorrectStreak: 0 };
    const newQueue = [...rest];
    newQueue.splice(pos, 0, updatedEntry);

    return { newQueue, entry: updatedEntry, wasMastered: false };
  }
}
