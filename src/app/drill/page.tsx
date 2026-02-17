'use client';

// Drilling session page

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DrillCard } from '@/components/DrillCard';
import { SessionCompletionScreen } from '@/components/SessionCompletionScreen';
import { useVocabStore } from '@/store/useVocabStore';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function DrillPage() {
  const router = useRouter();
  const { currentSession, sessionWords, appState } = useVocabStore();

  // Redirect to dashboard if no active session
  useEffect(() => {
    if (!currentSession) {
      router.push('/');
    }
  }, [currentSession, router]);

  if (!currentSession) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="p-12 text-center">
          <p className="mb-4 text-gray-500">No active drill session</p>
          <Button onClick={() => router.push('/')}>Go to Dashboard</Button>
        </CardContent>
      </Card>
    );
  }

  // Show completion screen if session is done
  if (currentSession.completedAt) {
    const correctAnswers = currentSession.wordResults.filter(r => r.isCorrect).length;
    const incorrectAnswers = currentSession.wordResults.filter(r => !r.isCorrect && !r.isNearMatch).length;
    const nearMatches = currentSession.wordResults.filter(r => r.isNearMatch && !r.isCorrect).length;
    const totalAnswers = currentSession.wordResults.length;

    return (
      <SessionCompletionScreen
        accuracy={currentSession.accuracy}
        wordsReviewed={totalAnswers}
        correctAnswers={correctAnswers}
        incorrectAnswers={incorrectAnswers}
        nearMatches={nearMatches}
        dailyStreak={appState.dailyStreak}
      />
    );
  }

  return <DrillCard />;
}
