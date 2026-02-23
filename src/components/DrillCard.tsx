'use client';

// Lingvist-style drilling interface with Portuguese sentences

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useVocabStore } from '@/store/useVocabStore';
import { isNearMatch } from '@/lib/utils';
import { insertErrorLog } from '@/lib/supabase-data';
import type { Word, QueueEntry } from '@/types';

/**
 * Replace the target word in a sentence with '_____', handling accented characters.
 * Uses Unicode \p{L} instead of \b to correctly handle word boundaries with accents.
 */
function createBlankSentence(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Use Unicode-aware boundary: word surrounded by non-letter chars (or start/end)
  const pattern = new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, 'giu');
  const result = sentence.replace(pattern, '$1_____$2');

  // Fallback: if the Unicode boundary didn't match, try simple case-insensitive replace
  if (result === sentence && sentence.toLowerCase().includes(word.toLowerCase())) {
    return sentence.replace(new RegExp(escaped, 'gi'), '_____');
  }

  return result;
}

/**
 * Split a sentence into parts: strings and gap markers, handling accented characters.
 */
function splitSentenceIntoParts(sentence: string, word: string): (string | { type: 'gap' })[] {
  const blank = createBlankSentence(sentence, word);
  const segments = blank.split('_____');
  const parts: (string | { type: 'gap' })[] = [];

  segments.forEach((segment, idx) => {
    if (segment) parts.push(segment);
    if (idx < segments.length - 1) parts.push({ type: 'gap' });
  });

  // If no gap was created (word not found), show whole sentence with a gap at end
  if (!parts.some(p => typeof p === 'object')) {
    console.warn(`Word "${word}" not found in sentence: "${sentence}"`);
    return [sentence + ' ', { type: 'gap' }];
  }

  return parts;
}

export function DrillCard() {
  const [answer, setAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [nearMatch, setNearMatch] = useState(false);
  const [currentSentence, setCurrentSentence] = useState('');
  const [currentEnglishSentence, setCurrentEnglishSentence] = useState('');
  const [currentSentenceId, setCurrentSentenceId] = useState<string | null>(null);
  const [feedbackWord, setFeedbackWord] = useState<Word | null>(null);
  const [feedbackSentence, setFeedbackSentence] = useState('');
  const [feedbackEnglishSentence, setFeedbackEnglishSentence] = useState('');
  const [feedbackSentenceId, setFeedbackSentenceId] = useState<string | null>(null);
  const [feedbackStreak, setFeedbackStreak] = useState(0);
  const [showGhost, setShowGhost] = useState(false);
  const [ghostKey, setGhostKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerStartRef = useRef<number>(Date.now());

  const {
    currentSession,
    sessionQueue,
    sessionMasteredIds,
    sessionTotalWords,
    submitAnswer,
    completeSession,
    getCurrentWord,
    getCurrentQueueEntry,
    muteWord,
  } = useVocabStore();

  const currentWord = getCurrentWord();
  const currentQueueEntry = getCurrentQueueEntry();

  // Re-read the word from the store for live stats (submitAnswer updates the words array)
  const liveWord = useVocabStore(state =>
    currentWord ? state.words.find(w => w.id === currentWord.id) : null
  );

  // Use feedbackWord/feedbackSentence during correct-answer feedback, otherwise current
  const displayWord = showFeedback ? feedbackWord : currentWord;
  const displaySentence = showFeedback ? feedbackSentence : currentSentence;
  const displayEnglishSentence = showFeedback ? feedbackEnglishSentence : currentEnglishSentence;

  const masteredCount = sessionMasteredIds.length;

  // Pick a random sentence when the word changes
  useEffect(() => {
    if (!currentWord?.exampleSentences?.length) {
      setCurrentSentence('');
      setCurrentEnglishSentence('');
      setCurrentSentenceId(null);
      return;
    }
    const idx = Math.floor(Math.random() * currentWord.exampleSentences.length);
    const pair = currentWord.exampleSentences[idx];
    setCurrentSentence(pair.pt);
    setCurrentEnglishSentence(pair.en);
    setCurrentSentenceId(pair.id);
    // Reset answer timer when word changes
    answerStartRef.current = Date.now();
  }, [currentWord?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset state when advancing to a new word
  useEffect(() => {
    if (!showFeedback) {
      setAnswer('');
      setNearMatch(false);
      setShowGhost(false);

      // Auto-focus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [currentQueueEntry?.wordId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
    };
  }, []);

  // Handle answer submission
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!currentWord || !currentQueueEntry || !answer.trim() || showFeedback) return;

      const correct = answer.trim().toLowerCase() === currentWord.portuguese.toLowerCase();
      const near = isNearMatch(answer.trim(), currentWord.portuguese);
      const timeToAnswerMs = Date.now() - answerStartRef.current;

      // Clear any existing timers
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);

      // Record the attempt in the store
      submitAnswer(currentWord.id, answer.trim());

      setIsCorrect(correct);
      setNearMatch(near);

      // Log to error_log in Supabase (fire-and-forget)
      const fuzzyScore = correct ? (near ? 0.9 : 1.0) : 0.0;
      let errorCategory: string | null = null;
      if (!correct && near) errorCategory = 'accent';
      else if (!correct) errorCategory = 'wrong';

      insertErrorLog({
        drill_type: 'word',
        sentence_id: currentSentenceId,
        word_id: currentWord.id,
        expected_answer: currentWord.portuguese,
        user_input: answer.trim(),
        is_correct: correct,
        time_to_answer_ms: timeToAnswerMs,
        fuzzy_score: fuzzyScore,
        error_category: errorCategory,
      }).catch(console.error);

      if (correct) {
        // Correct: lock current word/sentence for feedback display, block input
        setFeedbackWord(currentWord);
        setFeedbackSentence(currentSentence);
        setFeedbackEnglishSentence(currentEnglishSentence);
        setFeedbackSentenceId(currentSentenceId);
        setFeedbackStreak(currentQueueEntry.sessionCorrectStreak + 1);
        setShowFeedback(true);
        setShowGhost(false);

        feedbackTimerRef.current = setTimeout(() => {
          setShowFeedback(false);
          setFeedbackWord(null);
          setFeedbackSentence('');
          setFeedbackEnglishSentence('');
          setFeedbackSentenceId(null);
          setAnswer('');
          setNearMatch(false);
          // Reset timer for next word
          answerStartRef.current = Date.now();

          // Check if queue is now empty (session complete)
          const queue = useVocabStore.getState().sessionQueue;
          if (queue.length === 0) {
            setTimeout(() => completeSession(), 300);
          } else {
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }, 1500);
      } else {
        // Wrong: show ghost in gap (non-blocking), clear input, stay on same word
        setShowGhost(true);
        setGhostKey(prev => prev + 1);
        setFeedbackStreak(0);
        setAnswer('');
        // Reset timer for retry
        answerStartRef.current = Date.now();

        ghostTimerRef.current = setTimeout(() => {
          setShowGhost(false);
        }, 3000);

        // Focus input immediately so user can retry
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [currentWord, currentQueueEntry, answer, showFeedback, currentSentence, currentEnglishSentence, currentSentenceId, submitAnswer, completeSession]
  );

  // Handle "Learn Word" (show answer and move on)
  const handleLearnWord = useCallback(() => {
    if (!currentWord) return;

    setAnswer(currentWord.portuguese);
    setTimeout(() => handleSubmit(), 100);
  }, [currentWord, handleSubmit]);

  // Handle mute/skip word
  const handleMuteWord = useCallback(() => {
    if (!currentWord) return;

    muteWord(currentWord.id);

    // Check if queue is now empty after muting
    const queue = useVocabStore.getState().sessionQueue;
    if (queue.length === 0) {
      completeSession();
    }
  }, [currentWord, muteWord, completeSession]);

  if (!currentSession || !displayWord) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <p>No active session</p>
      </div>
    );
  }

  // Build sentence parts for inline rendering
  const sentenceParts = displaySentence
    ? splitSentenceIntoParts(displaySentence, displayWord.portuguese)
    : [{ type: 'gap' as const }];

  // Progress based on mastered count
  const progressPercent = sessionTotalWords > 0 ? (masteredCount / sessionTotalWords) * 100 : 0;

  // Streak dots for the current queue entry (4 dots, filled up to streak)
  const displayStreak = showFeedback ? feedbackStreak : (currentQueueEntry?.sessionCorrectStreak ?? 0);
  const streakDots = Array.from({ length: 4 }, (_, i) => i < displayStreak);

  // Get word status badge
  const statusBadge = displayWord.status === 'new'
    ? 'New'
    : displayWord.status === 'learned'
    ? 'Learned'
    : 'Learning';

  const statusColor = displayWord.status === 'new'
    ? 'bg-blue-900/30 text-blue-300'
    : displayWord.status === 'learned'
    ? 'bg-green-900/30 text-green-300'
    : 'bg-amber-900/30 text-amber-300';

  // Per-word stats (use live data from store for real-time updates)
  const statsWord = liveWord ?? displayWord;
  const wordStats = statsWord.totalAttempts === 0
    ? 'New word'
    : `All-time: ${statsWord.totalAttempts} attempts \u00b7 ${statsWord.totalCorrect} correct \u00b7 ${statsWord.totalWrong} wrong`;

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900">
      {/* Progress Bar - Top */}
      <div className="h-1 w-full bg-gray-800">
        <motion.div
          className="h-full bg-cyan-500"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Session Info - Below progress bar */}
      <div className="absolute left-4 top-4 md:left-6 md:top-6 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
        {/* Word Status Badge */}
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
          {statusBadge}
        </span>

        {/* Level indicator */}
        <span className="text-xs text-gray-400">
          Level {displayWord.level}/8
        </span>

        {/* Streak dots */}
        <div className="flex items-center gap-1">
          {streakDots.map((filled, i) => (
            <span
              key={i}
              className={`inline-block w-2 h-2 rounded-full ${
                filled ? 'bg-green-400' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Progress Counter */}
      <div className="absolute right-4 top-4 md:right-6 md:top-6 text-sm font-medium text-gray-400">
        {masteredCount} mastered / {sessionTotalWords} total
      </div>

      {/* Main Content Area - Centered with max-width */}
      <div className="flex flex-1 items-center justify-center px-4 pb-32 pt-16">
        <div className="w-full max-w-[550px] space-y-8">
          {/* Portuguese Sentence with Gap and Inline Feedback */}
          <div className="text-center">
            <p className="text-2xl md:text-3xl lg:text-4xl font-light leading-relaxed text-cyan-400">
              {sentenceParts.map((part, idx) => {
                if (typeof part === 'object' && part.type === 'gap') {
                  // This is the gap - show blank or feedback
                  if (showFeedback && isCorrect) {
                    // Correct answer: green text in the gap
                    return (
                      <span key={idx} className="relative inline-block mx-1">
                        <motion.span
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-green-400 font-semibold"
                        >
                          {displayWord.portuguese}
                        </motion.span>
                      </span>
                    );
                  } else if (showGhost) {
                    // Wrong answer: ghost fading in the gap (non-blocking)
                    return (
                      <span key={idx} className="relative inline-block mx-1">
                        <motion.span
                          key={ghostKey}
                          initial={{ opacity: 0.5 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 3, ease: 'easeOut' }}
                          className="text-red-400 font-semibold"
                        >
                          {displayWord.portuguese}
                        </motion.span>
                      </span>
                    );
                  } else {
                    // Blank gap
                    return (
                      <span key={idx} className="inline-block min-w-[100px] border-b-2 border-cyan-500/50 mx-1 pb-1">
                        {'\u00A0'}
                      </span>
                    );
                  }
                }
                return <span key={idx}>{part as string}</span>;
              })}
            </p>
          </div>

          {/* English Translation - Always Visible */}
          <div className="text-center space-y-2">
            <p className="text-lg md:text-xl text-gray-300 font-medium">
              {displayEnglishSentence || displayWord.english}
            </p>
            <p className="text-xs text-gray-500">
              {wordStats}
            </p>
          </div>
        </div>
      </div>

      {/* Input Area - Bottom Fixed, centered with max-width on desktop */}
      <div className="fixed inset-x-0 bottom-0 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[550px] p-4 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.input
              ref={inputRef}
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type the Portuguese word..."
              className={`w-full rounded-lg border-2 px-4 md:px-6 py-3 md:py-4 text-lg md:text-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                showFeedback && isCorrect
                  ? 'border-green-500 bg-green-900/30 focus:border-green-500 focus:ring-green-500/20'
                  : showGhost
                  ? 'border-red-500 bg-red-900/20 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-700 bg-gray-800 focus:border-cyan-500 focus:ring-cyan-500/20'
              }`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              lang="pt"
              inputMode="text"
              autoFocus
              disabled={showFeedback}
              animate={{
                backgroundColor: showFeedback && isCorrect
                  ? 'rgba(34, 197, 94, 0.2)'
                  : showGhost
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(31, 41, 55, 1)',
                borderColor: showFeedback && isCorrect
                  ? 'rgb(34, 197, 94)'
                  : showGhost
                  ? 'rgb(239, 68, 68)'
                  : 'rgb(55, 65, 81)',
              }}
              transition={{ duration: 0.3 }}
            />

            {/* Near-match feedback */}
            {showGhost && nearMatch && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-amber-400 text-sm"
              >
                Almost! Watch the accent: <span className="font-semibold">{currentWord?.portuguese}</span>
              </motion.div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleLearnWord}
                  className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
                  disabled={showFeedback}
                >
                  Learn word
                </button>

                <button
                  type="button"
                  onClick={handleMuteWord}
                  className="text-sm text-gray-400 hover:text-red-400 transition-colors"
                  disabled={showFeedback}
                  title="Skip this word (mute)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <button
                type="submit"
                disabled={!answer.trim() || showFeedback}
                className="rounded-lg bg-cyan-600 px-6 md:px-8 py-2.5 md:py-3 font-medium text-white hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-h-[44px]"
              >
                Check
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
