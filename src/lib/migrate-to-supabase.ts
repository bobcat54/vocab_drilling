// One-time migration from localStorage (Zustand persist) to Supabase

import { supabase } from './supabase';
import {
  insertGroups,
  insertWords,
  insertSentences,
  insertUserProgress,
} from './supabase-data';
import type {
  DbWord,
  DbSentence,
  DbUserProgress,
  DbGroup,
} from '@/types';

interface PersistedWord {
  id: string;
  portuguese: string;
  english: string;
  groupId: string;
  exampleSentences: ({ pt: string; en: string } | string)[];
  level: number;
  lastReviewDate: string | null;
  nextReviewDate: string;
  totalAttempts: number;
  totalCorrect: number;
  totalWrong: number;
  createdAt: string;
  isMuted: boolean;
  status: string;
}

interface PersistedGroup {
  id: string;
  name: string;
  theme: string;
  wordIds: string[];
  isUnlocked: boolean;
  completedSessions: number;
  accuracy: number;
  createdAt: string;
}

interface PersistedSession {
  id: string;
  groupId: string;
  startedAt: string;
  completedAt: string | null;
  accuracy: number;
  wordResults: { isCorrect: boolean }[];
}

interface PersistedState {
  state: {
    words: PersistedWord[];
    groups: PersistedGroup[];
    sessions: PersistedSession[];
  };
}

export async function migrateLocalStorageToSupabase(): Promise<boolean> {
  // Check if localStorage has data
  const raw = localStorage.getItem('vocab-storage');
  if (!raw) {
    console.log('[migrate] No localStorage data found');
    return false;
  }

  let parsed: PersistedState;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('[migrate] Failed to parse localStorage data');
    return false;
  }

  const { words, groups, sessions } = parsed.state;
  if (!words?.length && !groups?.length) {
    console.log('[migrate] No words/groups in localStorage');
    return false;
  }

  // Check if Supabase already has data (skip if it does)
  const { count } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true });
  if (count && count > 0) {
    console.log('[migrate] Supabase already has', count, 'words — skipping migration');
    return false;
  }

  console.log('[migrate] Starting migration:', words.length, 'words,', groups.length, 'groups,', sessions?.length ?? 0, 'sessions');

  // 1. Insert groups
  const dbGroups: DbGroup[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    theme: g.theme,
    is_unlocked: g.isUnlocked,
    completed_sessions: g.completedSessions,
    accuracy: g.accuracy,
    created_at: g.createdAt,
  }));
  await insertGroups(dbGroups);
  console.log('[migrate] Inserted', dbGroups.length, 'groups');

  // 2. Insert words
  const dbWords: DbWord[] = words.map((w) => ({
    id: w.id,
    portuguese: w.portuguese,
    english: w.english,
    group_id: w.groupId,
    created_at: w.createdAt,
  }));
  await insertWords(dbWords);
  console.log('[migrate] Inserted', dbWords.length, 'words');

  // 3. Insert sentences
  const dbSentences: DbSentence[] = [];
  for (const w of words) {
    for (const s of w.exampleSentences) {
      if (typeof s === 'string') {
        dbSentences.push({
          id: crypto.randomUUID(),
          target_word_id: w.id,
          sentence_pt: s,
          sentence_en: '',
        });
      } else {
        dbSentences.push({
          id: crypto.randomUUID(),
          target_word_id: w.id,
          sentence_pt: s.pt,
          sentence_en: s.en,
        });
      }
    }
  }
  await insertSentences(dbSentences);
  console.log('[migrate] Inserted', dbSentences.length, 'sentences');

  // 4. Insert user_progress
  const dbProgress: DbUserProgress[] = words.map((w) => ({
    item_type: 'word',
    item_id: w.id,
    level: w.isMuted ? w.level : w.level,
    next_review_date: w.nextReviewDate,
    last_review_date: w.lastReviewDate,
    total_attempts: w.totalAttempts,
    total_correct: w.totalCorrect,
    total_wrong: w.totalWrong,
    is_muted: w.isMuted,
    has_been_mastered: w.level >= 6,
  }));
  await insertUserProgress(dbProgress);
  console.log('[migrate] Inserted', dbProgress.length, 'user_progress rows');

  // 5. Insert drill_sessions
  if (sessions?.length) {
    for (const s of sessions) {
      const correctCount = s.wordResults?.filter((r) => r.isCorrect).length ?? 0;
      const totalCount = s.wordResults?.length ?? 0;
      const { error } = await supabase.from('drill_sessions').insert({
        id: s.id,
        group_id: s.groupId,
        started_at: s.startedAt,
        completed_at: s.completedAt,
        accuracy: s.accuracy,
        total_answers: totalCount,
        correct_answers: correctCount,
      });
      if (error) console.error('[migrate] drill_session insert error:', error);
    }
    console.log('[migrate] Inserted', sessions.length, 'drill_sessions');
  }

  console.log('[migrate] Migration complete!');
  return true;
}
