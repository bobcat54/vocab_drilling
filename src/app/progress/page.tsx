'use client';

// Detailed progress page with session history

import { useRouter } from 'next/navigation';
import { SimpleHeader } from '@/components/SimpleHeader';
import { useVocabStore } from '@/store/useVocabStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

export default function ProgressPage() {
  const router = useRouter();
  const { sessions, groups, appState } = useVocabStore();

  // Sort sessions by date (most recent first)
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-900">
      <SimpleHeader />
      <main className="container mx-auto px-4 py-8 flex justify-center">
        <div className="w-full max-w-4xl space-y-6">
      {/* Overall Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Statistics</CardTitle>
          <CardDescription>Your complete learning progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {appState.totalWordsLearned}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Words Learned</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {appState.overallAccuracy}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Accuracy</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {sessions.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Sessions</div>
            </div>
            <div className="rounded-lg bg-orange-50 p-4 dark:bg-orange-900/20">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {groups.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Groups</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
          <CardDescription>Review your past drilling sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedSessions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="mb-4 text-gray-500">No sessions yet</p>
              <Button variant="primary" onClick={() => router.push('/')}>
                Start Your First Drill
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSessions.map((session) => {
                const group = groups.find((g) => g.id === session.groupId);
                const correctAnswers = session.wordResults.filter((r) => r.isCorrect).length;
                const totalAnswers = session.wordResults.length;

                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <div>
                      <h4 className="font-medium">{group?.name || 'Unknown Group'}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(session.startedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Words</div>
                        <div className="font-medium">
                          {correctAnswers}/{totalAnswers}
                        </div>
                      </div>

                      <div
                        className={`rounded-full px-4 py-1 text-sm font-medium ${
                          session.accuracy >= 80
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : session.accuracy >= 60
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {session.accuracy}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

          {/* Back Button */}
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => router.push('/')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
