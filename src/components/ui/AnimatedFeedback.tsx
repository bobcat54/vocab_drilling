'use client';

// Animated feedback component for correct/incorrect answers

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface AnimatedFeedbackProps {
  isVisible: boolean;
  isCorrect: boolean;
  correctAnswer?: string;
  onDismiss: () => void;
}

export function AnimatedFeedback({
  isVisible,
  isCorrect,
  correctAnswer,
  onDismiss,
}: AnimatedFeedbackProps) {
  // Auto-dismiss after 2 seconds
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onDismiss, 2000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onDismiss]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            exit={{ y: 20 }}
            className={cn(
              'mx-4 rounded-2xl p-8 text-center shadow-2xl',
              isCorrect
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            )}
          >
            {/* Success Icon */}
            {isCorrect && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="mb-4 flex justify-center"
              >
                <svg
                  className="h-20 w-20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.div>
            )}

            {/* Error Icon */}
            {!isCorrect && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="mb-4 flex justify-center"
              >
                <svg
                  className="h-20 w-20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </motion.div>
            )}

            {/* Message */}
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-2 text-3xl font-bold"
            >
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </motion.h2>

            {/* Show correct answer if wrong */}
            {!isCorrect && correctAnswer && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-lg"
              >
                Correct answer: <span className="font-bold">{correctAnswer}</span>
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper function for cn (copied to avoid import issues)
function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
