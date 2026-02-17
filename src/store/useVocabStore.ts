// Zustand store for vocabulary app state management

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Word, WordGroup, DrillSession, WordResult, AppState, CSVRow, WordStatus } from '@/types';
import { groupWords, assignWordsToGroups } from '@/lib/word-grouping';
import { generateAllSentences, generateFallbackSentences } from '@/lib/sentence-generator';
import { calculateSM2, getQualityScore, getDueWords, getDefaultSM2Params } from '@/lib/sm2-algorithm';
import { compareStrings, calculateAccuracy, shuffle, isNearMatch } from '@/lib/utils';

interface VocabStore {
  // State
  words: Word[];
  groups: WordGroup[];
  sessions: DrillSession[];
  appState: AppState;
  currentSession: DrillSession | null;
  currentWordIndex: number;
  sessionWords: Word[]; // Words for current session
  isLoading: boolean;
  error: string | null;
  importProgress: { current: number; total: number } | null;

  // Actions - CSV Import
  importWords: (csvData: CSVRow[]) => Promise<void>;

  // Actions - Drilling
  startDrillSession: (groupId: string) => void;
  submitAnswer: (wordId: string, answer: string) => void;
  advanceWord: () => void;
  completeSession: () => void;
  getCurrentWord: () => Word | null;
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
  persist(
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
        theme: 'light',
        lastUpdated: new Date().toISOString(),
        dailyStreak: 0,
        lastSessionDate: null,
        sessionGoal: 50,
      },
      currentSession: null,
      currentWordIndex: 0,
      sessionWords: [],
      isLoading: false,
      error: null,
      importProgress: null,

      // Import words from CSV
      importWords: async (csvData: CSVRow[]) => {
        set({ isLoading: true, error: null, importProgress: { current: 0, total: csvData.length } });

        try {
          // Step 1: Group words by theme
          const groups = groupWords(csvData);

          // Step 2: Assign words to groups
          const groupWordMap = assignWordsToGroups(csvData, groups);

          // Step 3: Generate example sentences via API (with progress)
          const sentencesMap = await generateAllSentences(csvData, (current, total) => {
            set({ importProgress: { current, total } });
          });

          // Step 4: Create Word objects
          const words: Word[] = [];
          groups.forEach(group => {
            const groupWords = groupWordMap.get(group.id) || [];
            const wordIds: string[] = [];

            groupWords.forEach(csvRow => {
              const wordId = crypto.randomUUID();
              wordIds.push(wordId);

              // Get sentences from API results, or fallback
              const exampleSentences = sentencesMap[csvRow.portuguese]
                || generateFallbackSentences(csvRow);

              words.push({
                id: wordId,
                portuguese: csvRow.portuguese,
                english: csvRow.english,
                groupId: group.id,
                exampleSentences,
                ...getDefaultSM2Params(),
                timesSeen: 0,
                timesCorrect: 0,
                lastReviewed: null,
                createdAt: new Date().toISOString(),
                isMuted: false,
                status: 'new' as WordStatus,
              });
            });

            // Update group with word IDs
            group.wordIds = wordIds;
          });

          // Update state
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
          console.error('Error importing words:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to import words',
            isLoading: false,
            importProgress: null,
          });
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

        // Get due words for this group (exclude muted words)
        const groupWords = words.filter(w => w.groupId === groupId && !w.isMuted);
        const dueWords = getDueWords(groupWords);

        // If no words are due, use all group words
        const sessionWords = dueWords.length > 0 ? dueWords : groupWords;

        // Shuffle words for variety
        const shuffledWords = shuffle(sessionWords);

        // Limit to session goal (default 50)
        const limitedWords = shuffledWords.slice(0, appState.sessionGoal);

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
          currentWordIndex: 0,
          sessionWords: limitedWords,
          appState: {
            ...appState,
            currentGroupId: groupId,
            lastUpdated: new Date().toISOString(),
          },
        });
      },

      // Submit an answer for the current word
      // Records the attempt but does NOT advance - DrillCard calls advanceWord() on correct
      submitAnswer: (wordId: string, answer: string) => {
        const { words, currentSession } = get();

        if (!currentSession) {
          set({ error: 'No active session' });
          return;
        }

        const word = words.find(w => w.id === wordId);
        if (!word) {
          set({ error: 'Word not found' });
          return;
        }

        // Check if answer is correct (case-insensitive, accent-insensitive)
        const isCorrect = compareStrings(answer, word.portuguese);
        const nearMatch = isNearMatch(answer, word.portuguese);

        // Only run SM-2 on correct answers
        let sm2Updates: Partial<Word> = {};
        let status: WordStatus = word.status;

        if (isCorrect) {
          const quality = getQualityScore(true);
          const sm2Result = calculateSM2(quality, word);

          if (sm2Result.repetitions >= 4 && sm2Result.easinessFactor >= 2.0) {
            status = 'learned';
          } else if (sm2Result.repetitions > 0 || word.timesSeen > 0) {
            status = 'learning';
          }

          sm2Updates = {
            easinessFactor: sm2Result.easinessFactor,
            interval: sm2Result.interval,
            repetitions: sm2Result.repetitions,
            nextReviewDate: sm2Result.nextReviewDate.toISOString(),
            status,
          };
        } else {
          // Mark as learning if wrong (not new anymore)
          if (word.status === 'new') {
            sm2Updates = { status: 'learning' };
          }
        }

        // Update word stats
        const updatedWord: Word = {
          ...word,
          ...sm2Updates,
          timesSeen: word.timesSeen + 1,
          timesCorrect: word.timesCorrect + (isCorrect ? 1 : 0),
          lastReviewed: new Date().toISOString(),
        };

        // Create word result
        const wordResult: WordResult = {
          wordId,
          userAnswer: answer,
          correctAnswer: word.portuguese,
          isCorrect,
          isNearMatch: nearMatch,
          timestamp: new Date().toISOString(),
        };

        // Update state - do NOT advance currentWordIndex
        set({
          words: words.map(w => (w.id === wordId ? updatedWord : w)),
          currentSession: {
            ...currentSession,
            wordResults: [...currentSession.wordResults, wordResult],
          },
        });
      },

      // Advance to the next word (called by DrillCard after correct answer feedback)
      advanceWord: () => {
        const { currentWordIndex } = get();
        set({ currentWordIndex: currentWordIndex + 1 });
      },

      // Skip current word (move to next)
      skipWord: () => {
        const { currentWordIndex } = get();
        set({ currentWordIndex: currentWordIndex + 1 });
      },

      // Complete the current drilling session
      completeSession: () => {
        const { currentSession, groups, sessions, words, appState } = get();

        if (!currentSession) return;

        // Calculate session accuracy
        const correctAnswers = currentSession.wordResults.filter(r => r.isCorrect).length;
        const totalAnswers = currentSession.wordResults.length;
        const sessionAccuracy = calculateAccuracy(correctAnswers, totalAnswers);

        // Complete session
        const completedSession: DrillSession = {
          ...currentSession,
          completedAt: new Date().toISOString(),
          accuracy: sessionAccuracy,
        };

        // Update group stats
        const group = groups.find(g => g.id === currentSession.groupId);
        if (!group) return;

        const groupWords = words.filter(w => w.groupId === group.id);
        const groupCorrect = groupWords.reduce((sum, w) => sum + w.timesCorrect, 0);
        const groupTotal = groupWords.reduce((sum, w) => sum + w.timesSeen, 0);
        const groupAccuracy = calculateAccuracy(groupCorrect, groupTotal);

        const updatedGroup: WordGroup = {
          ...group,
          completedSessions: group.completedSessions + 1,
          accuracy: groupAccuracy,
        };

        // Check if we should unlock next group
        // Unlock criteria: 80% accuracy and 2+ completed sessions
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

        // Calculate overall stats
        const totalCorrect = words.reduce((sum, w) => sum + w.timesCorrect, 0);
        const totalSeen = words.reduce((sum, w) => sum + w.timesSeen, 0);
        const overallAccuracy = calculateAccuracy(totalCorrect, totalSeen);
        const totalWordsLearned = words.filter(w => w.status === 'learned').length;

        // Update daily streak
        const today = new Date().toISOString().split('T')[0];
        const lastSession = appState.lastSessionDate;
        let dailyStreak = appState.dailyStreak;

        if (lastSession === null) {
          // First session ever
          dailyStreak = 1;
        } else if (lastSession === today) {
          // Already completed a session today, streak unchanged
          dailyStreak = appState.dailyStreak;
        } else {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (lastSession === yesterdayStr) {
            // Continued streak
            dailyStreak = appState.dailyStreak + 1;
          } else {
            // Broke streak, reset to 1
            dailyStreak = 1;
          }
        }

        // Update state
        set({
          sessions: [...sessions, completedSession],
          groups: updatedGroups,
          currentSession: null,
          currentWordIndex: 0,
          sessionWords: [],
          appState: {
            ...appState,
            totalWordsLearned,
            overallAccuracy,
            dailyStreak,
            lastSessionDate: today,
            lastUpdated: new Date().toISOString(),
          },
        });
      },

      // Get current word in session
      getCurrentWord: () => {
        const { sessionWords, currentWordIndex } = get();
        if (currentWordIndex >= sessionWords.length) return null;
        return sessionWords[currentWordIndex];
      },

      // Get due words for a specific group
      getDueWordsForGroup: (groupId: string) => {
        const { words } = get();
        const groupWords = words.filter(w => w.groupId === groupId);
        return getDueWords(groupWords);
      },

      // Get stats for a specific group
      getGroupStats: (groupId: string) => {
        const { words } = get();
        const groupWords = words.filter(w => w.groupId === groupId);
        const dueWords = getDueWords(groupWords);

        const correct = groupWords.reduce((sum, w) => sum + w.timesCorrect, 0);
        const total = groupWords.reduce((sum, w) => sum + w.timesSeen, 0);
        const accuracy = calculateAccuracy(correct, total);

        return {
          totalWords: groupWords.length,
          dueWords: dueWords.length,
          accuracy,
        };
      },

      // Unlock next group (manual override)
      unlockNextGroup: (currentGroupId: string) => {
        const { groups } = get();
        const currentIndex = groups.findIndex(g => g.id === currentGroupId);

        if (currentIndex >= 0 && currentIndex < groups.length - 1) {
          const updatedGroups = [...groups];
          updatedGroups[currentIndex + 1].isUnlocked = true;
          set({ groups: updatedGroups });
        }
      },

      // Toggle theme
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

        // Update document class for Tailwind dark mode
        if (typeof document !== 'undefined') {
          if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },

      // Set error message
      setError: (error: string | null) => {
        set({ error });
      },

      // Mute a word (exclude from future sessions)
      muteWord: (wordId: string) => {
        const { words } = get();
        set({
          words: words.map(w => (w.id === wordId ? { ...w, isMuted: true } : w)),
        });
      },

      // Unmute a word
      unmuteWord: (wordId: string) => {
        const { words } = get();
        set({
          words: words.map(w => (w.id === wordId ? { ...w, isMuted: false } : w)),
        });
      },

      // Clear all app data
      clearAllData: () => {
        set({
          words: [],
          groups: [],
          sessions: [],
          appState: {
            currentGroupId: null,
            completedGroupIds: [],
            totalWordsLearned: 0,
            overallAccuracy: 0,
            theme: 'light',
            lastUpdated: new Date().toISOString(),
            dailyStreak: 0,
            lastSessionDate: null,
            sessionGoal: 50,
          },
          currentSession: null,
          currentWordIndex: 0,
          sessionWords: [],
          error: null,
          importProgress: null,
        });
      },
    }),
    {
      name: 'vocab-storage',
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0) {
          // Migrate from exampleSentence (string) to exampleSentences (string[])
          if (Array.isArray(state.words)) {
            state.words = (state.words as Record<string, unknown>[]).map(w => ({
              ...w,
              exampleSentences: (w as { exampleSentences?: string[]; exampleSentence?: string }).exampleSentences
                || ((w as { exampleSentence?: string }).exampleSentence
                  ? [(w as { exampleSentence: string }).exampleSentence]
                  : []),
            }));
          }
        }
        return state;
      },
    }
  )
);
