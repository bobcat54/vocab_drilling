// All Supabase read/write functions

import { supabase } from './supabase';
import type {
  Word,
  WordGroup,
  DrillSession,
  DbWord,
  DbSentence,
  DbUserProgress,
  DbGroup,
  DbDrillSession,
  DbErrorLog,
  WordStatus,
} from '@/types';

// --- READ ---

export async function fetchWords(): Promise<Word[]> {
  // Fetch words
  const { data: dbWords, error: wordsErr } = await supabase
    .from('words')
    .select('*');
  if (wordsErr) throw wordsErr;
  if (!dbWords || dbWords.length === 0) return [];

  // Fetch sentences
  const { data: dbSentences, error: sentErr } = await supabase
    .from('sentences')
    .select('*');
  if (sentErr) throw sentErr;

  // Fetch user_progress for words
  const { data: dbProgress, error: progErr } = await supabase
    .from('user_progress')
    .select('*')
    .eq('item_type', 'word');
  if (progErr) throw progErr;

  // Index sentences by word id
  const sentencesByWord = new Map<string, { id: string; pt: string; en: string }[]>();
  for (const s of dbSentences || []) {
    const list = sentencesByWord.get(s.target_word_id) || [];
    list.push({ id: s.id, pt: s.sentence_pt, en: s.sentence_en });
    sentencesByWord.set(s.target_word_id, list);
  }

  // Index progress by item_id
  const progressByWord = new Map<string, DbUserProgress>();
  for (const p of dbProgress || []) {
    progressByWord.set(p.item_id, p);
  }

  return (dbWords as DbWord[]).map((w) => {
    const prog = progressByWord.get(w.id);
    const level = prog?.level ?? 0;
    const totalAttempts = prog?.total_attempts ?? 0;

    let status: WordStatus = 'new';
    if (level >= 6) status = 'learned';
    else if (totalAttempts > 0) status = 'learning';

    return {
      id: w.id,
      portuguese: w.portuguese,
      english: w.english,
      groupId: w.group_id,
      exampleSentences: sentencesByWord.get(w.id) || [],
      level,
      lastReviewDate: prog?.last_review_date ?? null,
      nextReviewDate: prog?.next_review_date ?? new Date().toISOString(),
      totalAttempts,
      totalCorrect: prog?.total_correct ?? 0,
      totalWrong: prog?.total_wrong ?? 0,
      createdAt: w.created_at,
      isMuted: prog?.is_muted ?? false,
      status,
    };
  });
}

export async function fetchGroups(): Promise<WordGroup[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  if (!data) return [];

  return (data as DbGroup[]).map((g) => ({
    id: g.id,
    name: g.name,
    theme: g.theme,
    wordIds: [], // populated after fetchWords
    isUnlocked: g.is_unlocked,
    completedSessions: g.completed_sessions,
    accuracy: g.accuracy,
    createdAt: g.created_at,
  }));
}

export async function fetchDrillSessions(): Promise<DrillSession[]> {
  const { data, error } = await supabase
    .from('drill_sessions')
    .select('*')
    .order('started_at', { ascending: true });
  if (error) throw error;
  if (!data) return [];

  return (data as DbDrillSession[]).map((s) => ({
    id: s.id,
    groupId: s.group_id,
    startedAt: s.started_at,
    completedAt: s.completed_at,
    wordResults: [], // not stored in Supabase; error_log used instead
    accuracy: s.accuracy,
  }));
}

// --- WRITE ---

export async function upsertWordProgress(wordId: string, word: Word): Promise<void> {
  const row: DbUserProgress = {
    item_type: 'word',
    item_id: wordId,
    level: word.level,
    next_review_date: word.nextReviewDate,
    last_review_date: word.lastReviewDate,
    total_attempts: word.totalAttempts,
    total_correct: word.totalCorrect,
    total_wrong: word.totalWrong,
    is_muted: word.isMuted,
    has_been_mastered: word.level >= 6,
  };

  const { error } = await supabase
    .from('user_progress')
    .upsert(row, { onConflict: 'item_type,item_id' });
  if (error) logSupabaseError('upsertWordProgress', error);
}

export async function updateGroup(group: WordGroup): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({
      is_unlocked: group.isUnlocked,
      completed_sessions: group.completedSessions,
      accuracy: group.accuracy,
    })
    .eq('id', group.id);
  if (error) logSupabaseError('updateGroup', error);
}

export async function insertDrillSession(
  session: DrillSession,
  correctCount: number
): Promise<void> {
  const row: DbDrillSession = {
    id: session.id,
    group_id: session.groupId,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    accuracy: session.accuracy,
    total_answers: session.wordResults.length,
    correct_answers: correctCount,
  };

  const { error } = await supabase.from('drill_sessions').insert(row);
  if (error) logSupabaseError('insertDrillSession', error);
}

export async function insertErrorLog(entry: DbErrorLog): Promise<void> {
  const { error } = await supabase.from('error_log').insert(entry);
  if (error) logSupabaseError('insertErrorLog', error);
}

// --- BATCH INSERTS (for import/migration) ---

function logSupabaseError(context: string, error: { message: string; details?: string; hint?: string; code?: string }) {
  console.error(`[Supabase ${context}] message: ${error.message}`);
  if (error.details) console.error(`[Supabase ${context}] details: ${error.details}`);
  if (error.hint) console.error(`[Supabase ${context}] hint: ${error.hint}`);
  if (error.code) console.error(`[Supabase ${context}] code: ${error.code}`);
}

export async function insertGroups(groups: DbGroup[]): Promise<void> {
  if (groups.length === 0) return;
  const { error } = await supabase.from('groups').insert(groups);
  if (error) { logSupabaseError('insertGroups', error); throw error; }
}

export async function insertWords(words: DbWord[]): Promise<void> {
  if (words.length === 0) return;
  for (let i = 0; i < words.length; i += 500) {
    const chunk = words.slice(i, i + 500);
    const { error } = await supabase.from('words').insert(chunk);
    if (error) { logSupabaseError('insertWords', error); throw error; }
  }
}

export async function insertSentences(sentences: DbSentence[]): Promise<void> {
  if (sentences.length === 0) return;
  for (let i = 0; i < sentences.length; i += 500) {
    const chunk = sentences.slice(i, i + 500);
    const { error } = await supabase.from('sentences').insert(chunk);
    if (error) { logSupabaseError('insertSentences', error); throw error; }
  }
}

export async function insertUserProgress(rows: DbUserProgress[]): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from('user_progress').insert(chunk);
    if (error) { logSupabaseError('insertUserProgress', error); throw error; }
  }
}

// --- DELETE ALL (for clearAllData) ---

export async function deleteAllData(): Promise<void> {
  // Order matters due to FK constraints
  await supabase.from('error_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('user_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('sentences').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('drill_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('words').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
