// Zustand store for vocabulary app state management

import { create } from 'zustand';
import type { Word, WordGroup, DrillSession, WordResult, AppState, CSVRow, WordStatus, QueueEntry, DbWord, DbSentence, DbGroup, DbUserProgress } from '@/types';
import { groupWords, assignWordsToGroups } from '@/lib/word-grouping';
import { generateAllSentences, generateFallbackSentences } from '@/lib/sentence-generator';
import { getDueWords, getDefaultLevelParams, advanceLevel, dropLevel, calculateNextReviewDate } from '@/lib/level-system';
import { buildInitialQueue, processAnswer } from '@/lib/session-queue';
import { calculateAccuracy, isNearMatch } from '@/lib/utils';
import {
  fetchWords,
  fetchGroups,
  fetchDrillSessions,
  upsertWordProgress,
  updateGroup,
  insertDrillSession,
  insertGroups,
  insertWords,
  insertSentences,
  insertUserProgress,
  deleteAllData,
} from '@/lib/supabase-data';

interface VocabStore {
  // State
  words: Word[];
  groups: WordGroup[];
  sessions: DrillSession[];
  appState: AppState;
  currentSession: DrillSession | null;
  sessionQueue: QueueEntry[];
  sessionMasteredIds: string[];
  sessionTotalWords: number;
  isLoading: boolean;
  error: string | null;
  importProgress: { current: number; total: number } | null;
  dataLoaded: boolean;

  // Actions - Data loading
  loadFromSupabase: () => Promise<void>;

  // Actions - CSV Import
  importWords: (csvData: CSVRow[]) => Promise<void>;

  // Actions - Drilling
  startDrillSession: (groupId: string) => void;
  submitAnswer: (wordId: string, answer: string) => void;
  completeSession: () => void;
  getCurrentWord: () => Word | null;
  getCurrentQueueEntry: () => QueueEntry | null;
  clearSession: () => void;
  skipWord: () => void;
  muteWord: (wordId: string) => void;
  unmuteWord: (wordId: string) => void;

  // Actions - Progress
  getGroupStats: (groupId: string) => {
    totalWords: number;
    dueWords: number;
    accuracy: number;
  };
  getDueWordsForGroup: (groupId: string) => Word[];
  unlockNextGroup: (currentGroupId: string) => void;

  // Actions - Settings
  toggleTheme: () => void;
  clearAllData: () => void;
  setError: (error: string | null) => void;
}

export const useVocabStore = create<VocabStore>()(
  (set, get) => ({
    // Initial state
    words: [],
    groups: [],
    sessions: [],
    appState: {
      currentGroupId: null,
      completedGroupIds: [],
      totalWordsLearned: 0,
      overallAccuracy: 0,
      theme: 'dark',
      lastUpdated: new Date().toISOString(),
      dailyStreak: 0,
      lastSessionDate: null,
      sessionGoal: 50,
    },
    currentSession: null,
    sessionQueue: [],
    sessionMasteredIds: [],
    sessionTotalWords: 0,
    isLoading: false,
    error: null,
    importProgress: null,
    dataLoaded: false,

    // Load all data from Supabase
    loadFromSupabase: async () => {
      try {
        const [words, groups, sessions] = await Promise.all([
          fetchWords(),
          fetchGroups(),
          fetchDrillSessions(),
        ]);

        // Populate wordIds on groups from fetched words
        const wordsByGroup = new Map<string, string[]>();
        for (const w of words) {
          const list = wordsByGroup.get(w.groupId) || [];
          list.push(w.id);
          wordsByGroup.set(w.groupId, list);
        }
        for (const g of groups) {
          g.wordIds = wordsByGroup.get(g.id) || [];
        }

        // Compute appState from data
        const totalWordsLearned = words.filter(w => w.status === 'learned').length;
        const totalCorrect = words.reduce((sum, w) => sum + w.totalCorrect, 0);
        const totalAttempts = words.reduce((sum, w) => sum + w.totalAttempts, 0);
        const overallAccuracy = calculateAccuracy(totalCorrect, totalAttempts);

        // Compute daily streak from drill_sessions
        let dailyStreak = 0;
        let lastSessionDate: string | null = null;
        if (sessions.length > 0) {
          // Get unique session dates, sorted descending
          const sessionDates = [...new Set(
            sessions
              .filter(s => s.completedAt)
              .map(s => s.completedAt!.split('T')[0])
          )].sort().reverse();

          if (sessionDates.length > 0) {
            lastSessionDate = sessionDates[0];
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            // Count streak from today/yesterday backwards
            if (sessionDates[0] === today || sessionDates[0] === yesterdayStr) {
              dailyStreak = 1;
              let checkDate = new Date(sessionDates[0]);
              for (let i = 1; i < sessionDates.length; i++) {
                checkDate.setDate(checkDate.getDate() - 1);
                const expected = checkDate.toISOString().split('T')[0];
                if (sessionDates[i] === expected) {
                  dailyStreak++;
                } else {
                  break;
                }
              }
            }
          }
        }

        const currentGroupId = groups.length > 0 ? groups[0].id : null;

        set({
          words,
          groups,
          sessions,
          appState: {
            ...get().appState,
            currentGroupId,
            totalWordsLearned,
            overallAccuracy,
            dailyStreak,
            lastSessionDate,
            lastUpdated: new Date().toISOString(),
          },
          dataLoaded: true,
        });
      } catch (err) {
        console.error('[loadFromSupabase] Error:', err);
        set({ error: 'Failed to load data from Supabase', dataLoaded: true });
      }
    },

    // Import words from CSV
    importWords: async (csvData: CSVRow[]) => {
      console.log('[importWords] Starting import with', csvData.length, 'CSV rows');
      set({ isLoading: true, error: null, importProgress: { current: 0, total: csvData.length } });

      try {
        // Step 1: Group words by theme
        const groups = groupWords(csvData);
        console.log('[importWords] Created', groups.length, 'groups');

        // Step 2: Assign words to groups
        const groupWordMap = assignWordsToGroups(csvData, groups);

        // Step 3: Generate example sentences via API (with progress)
        const sentencesMap = await generateAllSentences(csvData, (current, total) => {
          set({ importProgress: { current, total } });
        });

        // Step 4: Create Word objects and DB rows
        const words: Word[] = [];
        const dbWords: DbWord[] = [];
        const dbSentences: DbSentence[] = [];
        const dbProgress: DbUserProgress[] = [];
        const dbGroups: DbGroup[] = groups.map(g => ({
          id: g.id,
          name: g.name,
          theme: g.theme,
          is_unlocked: g.isUnlocked,
          completed_sessions: g.completedSessions,
          accuracy: g.accuracy,
          created_at: g.createdAt,
        }));

        groups.forEach(group => {
          const gWords = groupWordMap.get(group.id) || [];
          const wordIds: string[] = [];

          gWords.forEach(csvRow => {
            const wordId = crypto.randomUUID();
            wordIds.push(wordId);

            const rawSentences = sentencesMap[csvRow.portuguese]
              || generateFallbackSentences(csvRow);

            // Assign IDs to sentences
            const exampleSentences = rawSentences.map(s => ({
              id: crypto.randomUUID(),
              pt: s.pt,
              en: s.en,
            }));

            const defaults = getDefaultLevelParams();

            words.push({
              id: wordId,
              portuguese: csvRow.portuguese,
              english: csvRow.english,
              groupId: group.id,
              exampleSentences,
              ...defaults,
              createdAt: new Date().toISOString(),
              isMuted: false,
              status: 'new' as WordStatus,
            });

            dbWords.push({
              id: wordId,
              portuguese: csvRow.portuguese,
              english: csvRow.english,
              group_id: group.id,
              created_at: new Date().toISOString(),
            });

            for (const s of exampleSentences) {
              dbSentences.push({
                id: s.id,
                target_word_id: wordId,
                sentence_pt: s.pt,
                sentence_en: s.en,
              });
            }

            dbProgress.push({
              item_type: 'word',
              item_id: wordId,
              level: defaults.level,
              next_review_date: defaults.nextReviewDate,
              last_review_date: defaults.lastReviewDate,
              total_attempts: defaults.totalAttempts,
              total_correct: defaults.totalCorrect,
              total_wrong: defaults.totalWrong,
              is_muted: false,
              has_been_mastered: false,
            });
          });

          group.wordIds = wordIds;
        });

        // Insert into Supabase: groups → words → sentences → user_progress
        await insertGroups(dbGroups);
        await insertWords(dbWords);
        await insertSentences(dbSentences);
        await insertUserProgress(dbProgress);

        console.log('[importWords] Inserted into Supabase:', dbGroups.length, 'groups,', dbWords.length, 'words,', dbSentences.length, 'sentences');

        // Update Zustand state
        set({
          words,
          groups,
          appState: {
            ...get().appState,
            currentGroupId: groups.length > 0 ? groups[0].id : null,
            lastUpdated: new Date().toISOString(),
          },
          isLoading: false,
          importProgress: null,
        });
      } catch (error) {
        console.error('[importWords] ERROR:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to import words';
        set({ error: errorMessage, isLoading: false, importProgress: null });
        throw new Error(errorMessage);
      }
    },

    // Start a new drilling session
    startDrillSession: (groupId: string) => {
      const { words, groups, appState } = get();

      const group = groups.find(g => g.id === groupId);
      if (!group || !group.isUnlocked) {
        set({ error: 'Group not found or locked' });
        return;
      }

      const groupWords = words.filter(w => w.groupId === groupId && !w.isMuted);
      const dueWords = getDueWords(groupWords);
      const selectedWords = dueWords.length > 0
        ? dueWords
        : [...groupWords].sort((a, b) => a.level - b.level);

      const queue = buildInitialQueue(selectedWords, appState.sessionGoal);

      const session: DrillSession = {
        id: crypto.randomUUID(),
        groupId,
        startedAt: new Date().toISOString(),
        completedAt: null,
        wordResults: [],
        accuracy: 0,
      };

      set({
        currentSession: session,
        sessionQueue: queue,
        sessionMasteredIds: [],
        sessionTotalWords: queue.length,
        appState: {
          ...appState,
          currentGroupId: groupId,
          lastUpdated: new Date().toISOString(),
        },
      });
    },

    // Submit an answer for the current word
    submitAnswer: (wordId: string, answer: string) => {
      const { words, currentSession, sessionQueue, sessionMasteredIds } = get();

      if (!currentSession) {
        set({ error: 'No active session' });
        return;
      }

      const word = words.find(w => w.id === wordId);
      if (!word) {
        set({ error: 'Word not found' });
        return;
      }

      const isCorrect = answer.trim().toLowerCase() === word.portuguese.toLowerCase();
      const nearMatch = isNearMatch(answer, word.portuguese);

      let status: WordStatus = word.status;
      if (word.status === 'new' && word.totalAttempts === 0) {
        status = 'learning';
      }

      const updatedWord: Word = {
        ...word,
        totalAttempts: word.totalAttempts + 1,
        totalCorrect: word.totalCorrect + (isCorrect ? 1 : 0),
        totalWrong: word.totalWrong + (isCorrect ? 0 : 1),
        lastReviewDate: new Date().toISOString(),
        status,
      };

      const wordResult: WordResult = {
        wordId,
        userAnswer: answer,
        correctAnswer: word.portuguese,
        isCorrect,
        isNearMatch: nearMatch,
        timestamp: new Date().toISOString(),
      };

      if (isCorrect) {
        const { newQueue, wasMastered } = processAnswer(sessionQueue, true);
        const newMasteredIds = wasMastered
          ? [...sessionMasteredIds, wordId]
          : sessionMasteredIds;

        set({
          words: words.map(w => (w.id === wordId ? updatedWord : w)),
          currentSession: {
            ...currentSession,
            wordResults: [...currentSession.wordResults, wordResult],
          },
          sessionQueue: newQueue,
          sessionMasteredIds: newMasteredIds,
        });
      } else {
        const updatedQueue = sessionQueue.length > 0
          ? [{ ...sessionQueue[0], sessionCorrectStreak: 0 }, ...sessionQueue.slice(1)]
          : sessionQueue;

        set({
          words: words.map(w => (w.id === wordId ? updatedWord : w)),
          currentSession: {
            ...currentSession,
            wordResults: [...currentSession.wordResults, wordResult],
          },
          sessionQueue: updatedQueue,
        });
      }

      // Fire-and-forget: sync to Supabase
      upsertWordProgress(wordId, updatedWord).catch(console.error);
    },

    // Skip current word
    skipWord: () => {
      const { sessionQueue } = get();
      if (sessionQueue.length === 0) return;
      const { newQueue } = processAnswer(sessionQueue, false);
      set({ sessionQueue: newQueue });
    },

    // Complete the current drilling session
    completeSession: () => {
      const { currentSession, groups, sessions, words, appState, sessionMasteredIds } = get();

      if (!currentSession) return;

      const correctAnswers = currentSession.wordResults.filter(r => r.isCorrect).length;
      const totalAnswers = currentSession.wordResults.length;
      const sessionAccuracy = calculateAccuracy(correctAnswers, totalAnswers);

      const completedSession: DrillSession = {
        ...currentSession,
        completedAt: new Date().toISOString(),
        accuracy: sessionAccuracy,
      };

      // Determine level changes
      const sessionWordIds = new Set(currentSession.wordResults.map(r => r.wordId));
      const wordsWithWrongAnswer = new Set(
        currentSession.wordResults.filter(r => !r.isCorrect).map(r => r.wordId)
      );
      const masteredSet = new Set(sessionMasteredIds);

      const updatedWords = words.map(w => {
        if (!sessionWordIds.has(w.id)) return w;

        let newLevel = w.level;
        if (masteredSet.has(w.id)) {
          newLevel = advanceLevel(w.level);
        } else if (wordsWithWrongAnswer.has(w.id)) {
          newLevel = dropLevel(w.level);
        }

        const newStatus: WordStatus = newLevel >= 6 ? 'learned' : w.totalAttempts > 0 ? 'learning' : 'new';

        return {
          ...w,
          level: newLevel,
          nextReviewDate: calculateNextReviewDate(newLevel),
          status: newStatus,
        };
      });

      // Update group stats
      const group = groups.find(g => g.id === currentSession.groupId);
      if (!group) return;

      const groupWords = updatedWords.filter(w => w.groupId === group.id);
      const groupCorrect = groupWords.reduce((sum, w) => sum + w.totalCorrect, 0);
      const groupTotal = groupWords.reduce((sum, w) => sum + w.totalAttempts, 0);
      const groupAccuracy = calculateAccuracy(groupCorrect, groupTotal);

      const updatedGroup: WordGroup = {
        ...group,
        completedSessions: group.completedSessions + 1,
        accuracy: groupAccuracy,
      };

      const shouldUnlockNext = groupAccuracy >= 80 && updatedGroup.completedSessions >= 2;
      let updatedGroups = groups.map(g => (g.id === group.id ? updatedGroup : g));

      if (shouldUnlockNext) {
        const currentGroupIndex = updatedGroups.findIndex(g => g.id === group.id);
        const nextGroupIndex = currentGroupIndex + 1;
        if (nextGroupIndex < updatedGroups.length) {
          updatedGroups[nextGroupIndex] = {
            ...updatedGroups[nextGroupIndex],
            isUnlocked: true,
          };
        }
      }

      // Overall stats
      const totalCorrect = updatedWords.reduce((sum, w) => sum + w.totalCorrect, 0);
      const totalSeen = updatedWords.reduce((sum, w) => sum + w.totalAttempts, 0);
      const overallAccuracy = calculateAccuracy(totalCorrect, totalSeen);
      const totalWordsLearned = updatedWords.filter(w => w.status === 'learned').length;

      // Daily streak
      const today = new Date().toISOString().split('T')[0];
      const lastSession = appState.lastSessionDate;
      let dailyStreak = appState.dailyStreak;

      if (lastSession === null) {
        dailyStreak = 1;
      } else if (lastSession === today) {
        // no change
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        dailyStreak = lastSession === yesterdayStr ? appState.dailyStreak + 1 : 1;
      }

      set({
        words: updatedWords,
        sessions: [...sessions, completedSession],
        groups: updatedGroups,
        currentSession: completedSession,
        appState: {
          ...appState,
          totalWordsLearned,
          overallAccuracy,
          dailyStreak,
          lastSessionDate: today,
          lastUpdated: new Date().toISOString(),
        },
      });

      // Fire-and-forget: sync to Supabase
      insertDrillSession(completedSession, correctAnswers).catch(console.error);

      // Update progress for each session word
      for (const w of updatedWords) {
        if (sessionWordIds.has(w.id)) {
          upsertWordProgress(w.id, w).catch(console.error);
        }
      }

      // Update groups
      for (const g of updatedGroups) {
        const original = groups.find(og => og.id === g.id);
        if (original && (
          original.completedSessions !== g.completedSessions ||
          original.accuracy !== g.accuracy ||
          original.isUnlocked !== g.isUnlocked
        )) {
          updateGroup(g).catch(console.error);
        }
      }
    },

    getCurrentWord: () => {
      const { sessionQueue, words } = get();
      if (sessionQueue.length === 0) return null;
      return words.find(w => w.id === sessionQueue[0].wordId) || null;
    },

    getCurrentQueueEntry: () => {
      const { sessionQueue } = get();
      return sessionQueue.length > 0 ? sessionQueue[0] : null;
    },

    clearSession: () => {
      set({
        currentSession: null,
        sessionQueue: [],
        sessionMasteredIds: [],
        sessionTotalWords: 0,
      });
    },

    getDueWordsForGroup: (groupId: string) => {
      const { words } = get();
      const groupWords = words.filter(w => w.groupId === groupId);
      return getDueWords(groupWords);
    },

    getGroupStats: (groupId: string) => {
      const { words } = get();
      const groupWords = words.filter(w => w.groupId === groupId);
      const dueWords = getDueWords(groupWords);

      const correct = groupWords.reduce((sum, w) => sum + w.totalCorrect, 0);
      const total = groupWords.reduce((sum, w) => sum + w.totalAttempts, 0);
      const accuracy = calculateAccuracy(correct, total);

      return { totalWords: groupWords.length, dueWords: dueWords.length, accuracy };
    },

    unlockNextGroup: (currentGroupId: string) => {
      const { groups } = get();
      const currentIndex = groups.findIndex(g => g.id === currentGroupId);

      if (currentIndex >= 0 && currentIndex < groups.length - 1) {
        const updatedGroups = [...groups];
        updatedGroups[currentIndex + 1] = {
          ...updatedGroups[currentIndex + 1],
          isUnlocked: true,
        };
        set({ groups: updatedGroups });

        // Fire-and-forget: sync to Supabase
        updateGroup(updatedGroups[currentIndex + 1]).catch(console.error);
      }
    },

    toggleTheme: () => {
      const { appState } = get();
      const newTheme = appState.theme === 'light' ? 'dark' : 'light';

      set({
        appState: {
          ...appState,
          theme: newTheme,
          lastUpdated: new Date().toISOString(),
        },
      });

      if (typeof document !== 'undefined') {
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },

    setError: (error: string | null) => {
      set({ error });
    },

    muteWord: (wordId: string) => {
      const { words, sessionQueue } = get();
      const word = words.find(w => w.id === wordId);
      if (!word) return;

      const updatedWord = { ...word, isMuted: true };
      set({
        words: words.map(w => (w.id === wordId ? updatedWord : w)),
        sessionQueue: sessionQueue.filter(e => e.wordId !== wordId),
      });

      // Fire-and-forget: sync to Supabase
      upsertWordProgress(wordId, updatedWord).catch(console.error);
    },

    unmuteWord: (wordId: string) => {
      const { words } = get();
      const word = words.find(w => w.id === wordId);
      if (!word) return;

      const updatedWord = { ...word, isMuted: false };
      set({
        words: words.map(w => (w.id === wordId ? updatedWord : w)),
      });

      // Fire-and-forget: sync to Supabase
      upsertWordProgress(wordId, updatedWord).catch(console.error);
    },

    clearAllData: () => {
      // Fire-and-forget: delete all Supabase data
      deleteAllData().catch(console.error);

      set({
        words: [],
        groups: [],
        sessions: [],
        appState: {
          currentGroupId: null,
          completedGroupIds: [],
          totalWordsLearned: 0,
          overallAccuracy: 0,
          theme: 'dark',
          lastUpdated: new Date().toISOString(),
          dailyStreak: 0,
          lastSessionDate: null,
          sessionGoal: 50,
        },
        currentSession: null,
        sessionQueue: [],
        sessionMasteredIds: [],
        sessionTotalWords: 0,
        error: null,
        importProgress: null,
      });
    },
  })
);
