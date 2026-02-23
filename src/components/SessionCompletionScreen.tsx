'use client';

// Session completion screen shown after finishing a drill session

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface SessionCompletionScreenProps {
  accuracy: number;
  wordsReviewed: number;
  correctAnswers: number;
  incorrectAnswers: number;
  nearMatches: number;
  dailyStreak: number;
  wordsMastered: number;
  onNavigateAway: () => void;
}

export function SessionCompletionScreen({
  accuracy,
  wordsReviewed,
  correctAnswers,
  incorrectAnswers,
  nearMatches,
  dailyStreak,
  wordsMastered,
  onNavigateAway,
}: SessionCompletionScreenProps) {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    onNavigateAway();
    router.push(path);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8 rounded-2xl bg-gray-800/50 p-8 backdrop-blur-sm border border-gray-700"
      >
        {/* Success Icon */}
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="rounded-full bg-green-500/20 p-6"
          >
            <svg className="h-16 w-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Session Complete!</h1>
          <p className="mt-2 text-gray-400">Great job on your Portuguese practice</p>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          {/* Accuracy */}
          <div className="rounded-lg bg-gray-900/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Accuracy</span>
              <span className={`text-2xl font-bold ${accuracy >= 80 ? 'text-green-400' : 'text-amber-400'}`}>
                {accuracy}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-700">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${accuracy}%` }}
                transition={{ delay: 0.5, duration: 1 }}
                className={`h-full ${accuracy >= 80 ? 'bg-green-500' : 'bg-amber-500'}`}
              />
            </div>
          </div>

          {/* Words Reviewed */}
          <div className="rounded-lg bg-gray-900/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Words Reviewed</span>
              <span className="text-xl font-semibold text-white">{wordsReviewed}</span>
            </div>
          </div>

          {/* Words Mastered */}
          <div className="rounded-lg bg-gray-900/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Words Mastered</span>
              <span className="text-xl font-semibold text-cyan-400">{wordsMastered}</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-900/20 p-3 text-center border border-green-700/30">
              <div className="text-2xl font-bold text-green-400">{correctAnswers}</div>
              <div className="text-xs text-green-300">Correct</div>
            </div>

            {nearMatches > 0 && (
              <div className="rounded-lg bg-amber-900/20 p-3 text-center border border-amber-700/30">
                <div className="text-2xl font-bold text-amber-400">{nearMatches}</div>
                <div className="text-xs text-amber-300">Near Match</div>
              </div>
            )}

            <div className="rounded-lg bg-red-900/20 p-3 text-center border border-red-700/30">
              <div className="text-2xl font-bold text-red-400">{incorrectAnswers}</div>
              <div className="text-xs text-red-300">Incorrect</div>
            </div>
          </div>

          {/* Daily Streak */}
          {dailyStreak > 0 && (
            <div className="rounded-lg bg-orange-900/20 p-4 border border-orange-700/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  <span className="text-gray-400">Daily Streak</span>
                </div>
                <span className="text-xl font-bold text-orange-400">{dailyStreak} days</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => handleNavigate('/')}
            className="w-full rounded-lg bg-cyan-600 px-6 py-3 font-medium text-white hover:bg-cyan-500 transition-colors"
          >
            Back to Dashboard
          </button>

          <button
            onClick={() => handleNavigate('/progress')}
            className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-6 py-3 font-medium text-gray-300 hover:bg-gray-700/50 transition-colors"
          >
            View Progress
          </button>
        </div>
      </motion.div>
    </div>
  );
}
