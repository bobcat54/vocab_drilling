'use client';

// Lingvist-style drilling interface with Portuguese sentences

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useVocabStore } from '@/store/useVocabStore';
import { isNearMatch } from '@/lib/utils';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    currentSession,
    sessionWords,
    currentWordIndex,
    submitAnswer,
    advanceWord,
    completeSession,
    getCurrentWord,
    muteWord,
    appState,
  } = useVocabStore();

  const currentWord = getCurrentWord();

  // Re-read the word from the store for live stats (submitAnswer updates the words array)
  const liveWord = useVocabStore(state =>
    currentWord ? state.words.find(w => w.id === currentWord.id) : null
  );

  // Calculate session stats
  const correctCount = currentSession?.wordResults.filter(r => r.isCorrect).length || 0;
  const wrongCount = currentSession?.wordResults.filter(r => !r.isCorrect).length || 0;
  const totalAnswered = correctCount + wrongCount;
  const currentAccuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

  // Pick a random sentence when the word changes
  useEffect(() => {
    if (!currentWord?.exampleSentences?.length) {
      setCurrentSentence('');
      return;
    }
    const idx = Math.floor(Math.random() * currentWord.exampleSentences.length);
    setCurrentSentence(currentWord.exampleSentences[idx]);
  }, [currentWord?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset state when word changes (after advancement)
  useEffect(() => {
    setAnswer('');
    setShowFeedback(false);
    setNearMatch(false);

    // Auto-focus input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [currentWordIndex]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Handle answer submission
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!currentWord || !answer.trim() || showFeedback) return;

      const correct = answer.trim().toLowerCase() === currentWord.portuguese.toLowerCase();
      const near = isNearMatch(answer.trim(), currentWord.portuguese);

      // Record the attempt in the store (does NOT advance)
      submitAnswer(currentWord.id, answer.trim());

      // Show feedback
      setIsCorrect(correct);
      setNearMatch(near);
      setShowFeedback(true);

      // Clear any existing timer
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

      if (correct) {
        // Correct: show green for 1.5s, then advance
        feedbackTimerRef.current = setTimeout(() => {
          if (currentWordIndex + 1 >= sessionWords.length) {
            // Last word - complete session
            setTimeout(() => completeSession(), 300);
          } else {
            advanceWord();
          }
        }, 1500);
      } else {
        // Wrong: show ghost for 3s, then reset for retry
        feedbackTimerRef.current = setTimeout(() => {
          setShowFeedback(false);
          setAnswer('');
          setTimeout(() => {
            inputRef.current?.focus();
          }, 50);
        }, 3000);
      }
    },
    [currentWord, answer, showFeedback, submitAnswer, currentWordIndex, sessionWords.length, completeSession, advanceWord]
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

    // Advance to next word immediately
    if (currentWordIndex + 1 >= sessionWords.length) {
      completeSession();
    } else {
      advanceWord();
    }
  }, [currentWord, muteWord, currentWordIndex, sessionWords.length, completeSession, advanceWord]);

  if (!currentSession || !currentWord) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <p>No active session</p>
      </div>
    );
  }

  // Build sentence parts for inline rendering
  const sentenceParts = currentSentence
    ? splitSentenceIntoParts(currentSentence, currentWord.portuguese)
    : [{ type: 'gap' as const }];

  // Letter count hints (dashes) for Portuguese word
  const letterHints = currentWord.portuguese.split('').map((char, idx) => (
    <span key={idx} className="inline-block w-2 h-0.5 bg-cyan-500/40 mx-0.5" />
  ));

  const sessionGoal = appState.sessionGoal;
  const progress = `${currentWordIndex + 1}/${sessionGoal}`;
  const progressPercent = ((currentWordIndex + 1) / sessionGoal) * 100;

  // Get word status badge
  const statusBadge = currentWord?.status === 'new'
    ? 'New'
    : currentWord?.status === 'learned'
    ? 'Learned'
    : 'Learning';

  const statusColor = currentWord?.status === 'new'
    ? 'bg-blue-900/30 text-blue-300'
    : currentWord?.status === 'learned'
    ? 'bg-green-900/30 text-green-300'
    : 'bg-amber-900/30 text-amber-300';

  // Per-word stats (use live data from store for real-time updates)
  const wordTimesSeen = liveWord?.timesSeen ?? currentWord.timesSeen;
  const wordTimesCorrect = liveWord?.timesCorrect ?? currentWord.timesCorrect;
  const wordTimesWrong = wordTimesSeen - wordTimesCorrect;
  const wordStats = wordTimesSeen === 0
    ? 'New word'
    : `Attempts: ${wordTimesSeen} \u00b7 Correct: ${wordTimesCorrect} \u00b7 Wrong: ${wordTimesWrong}`;

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

      {/* Session Scoreboard - Below progress bar on mobile, side on desktop */}
      <div className="absolute left-4 top-4 md:left-6 md:top-6 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
        {/* Word Status Badge */}
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
          {statusBadge}
        </span>

        {/* Scoreboard */}
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="text-green-400">
            ✓ {correctCount}
          </span>
          <span className="text-red-400">
            ✗ {wrongCount}
          </span>
          <span className="text-gray-400">
            {currentAccuracy}%
          </span>
        </div>
      </div>

      {/* Progress Counter */}
      <div className="absolute right-4 top-4 md:right-6 md:top-6 text-sm font-medium text-gray-400">
        {progress}
      </div>

      {/* Main Content Area - Centered with max-width */}
      <div className="flex flex-1 items-center justify-center px-4 pb-32 pt-16">
        <div className="w-full max-w-[550px] space-y-8">
          {/* Letter Hints */}
          <div className="flex items-center justify-center">
            {letterHints}
          </div>

          {/* Portuguese Sentence with Gap and Inline Feedback */}
          <div className="text-center">
            <p className="text-2xl md:text-3xl lg:text-4xl font-light leading-relaxed text-cyan-400">
              {sentenceParts.map((part, idx) => {
                if (typeof part === 'object' && part.type === 'gap') {
                  // This is the gap - show blank or feedback
                  if (!showFeedback) {
                    // Show blank gap
                    return (
                      <span key={idx} className="inline-block min-w-[100px] border-b-2 border-cyan-500/50 mx-1 pb-1">
                        _____
                      </span>
                    );
                  } else {
                    // Show feedback inline
                    return (
                      <span key={idx} className="relative inline-block mx-1">
                        {/* Correct - green text */}
                        {isCorrect && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-green-400 font-semibold"
                          >
                            {currentWord.portuguese}
                          </motion.span>
                        )}

                        {/* Incorrect - red/orange ghost that fades to invisible, then blank reappears */}
                        {!isCorrect && (
                          <motion.span
                            initial={{ opacity: 0.5 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 3, ease: 'easeOut' }}
                            className="text-red-400 font-semibold"
                          >
                            {currentWord.portuguese}
                          </motion.span>
                        )}
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
              {currentWord.english}
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
                  : showFeedback && !isCorrect
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
                  : showFeedback && !isCorrect
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(31, 41, 55, 1)',
                borderColor: showFeedback && isCorrect
                  ? 'rgb(34, 197, 94)'
                  : showFeedback && !isCorrect
                  ? 'rgb(239, 68, 68)'
                  : 'rgb(55, 65, 81)',
              }}
              transition={{ duration: 0.3 }}
            />

            {/* Near-match feedback */}
            {showFeedback && nearMatch && !isCorrect && (
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
