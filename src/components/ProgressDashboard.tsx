'use client';

// Progress dashboard showing word groups and statistics

import { useRouter } from 'next/navigation';
import { useVocabStore } from '@/store/useVocabStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export function ProgressDashboard() {
  const router = useRouter();
  const { groups, words, appState, getGroupStats, startDrillSession } = useVocabStore();

  // Calculate word categories
  const newWords = words.filter(w => w.status === 'new').length;
  const learningWords = words.filter(w => w.status === 'learning').length;
  const learnedWords = words.filter(w => w.status === 'learned').length;

  const handleStartDrill = (groupId: string) => {
    startDrillSession(groupId);
    router.push('/drill');
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Daily Streak Banner */}
      {appState.dailyStreak > 0 && (
        <Card className="border-orange-700/50 bg-gradient-to-r from-orange-900/20 to-red-900/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-5xl">🔥</div>
                <div>
                  <div className="text-3xl font-bold text-orange-400">
                    {appState.dailyStreak} Day{appState.dailyStreak > 1 ? 's' : ''}
                  </div>
                  <div className="text-sm text-gray-300">Current Streak</div>
                </div>
              </div>
              <div className="text-right text-gray-400">
                <p className="text-sm">Keep it going!</p>
                <p className="text-xs">Practice every day to maintain your streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Your Progress</CardTitle>
          <CardDescription>Track your vocabulary learning journey</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {newWords}
              </div>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                New Words
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {learningWords}
              </div>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Learning
              </div>
            </div>
            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {learnedWords}
              </div>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Learned
              </div>
            </div>
            <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {appState.overallAccuracy}%
              </div>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Accuracy
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Word Groups */}
      <div>
        <h2 className="mb-4 text-2xl font-bold">Word Groups</h2>
        {groups.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">
                No word groups yet. Upload a CSV file to get started!
              </p>
              <Button
                variant="primary"
                className="mt-4"
                onClick={() => router.push('/upload')}
              >
                Upload Vocabulary
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const stats = getGroupStats(group.id);
              const isLocked = !group.isUnlocked;

              return (
                <Card
                  key={group.id}
                  className={isLocked ? 'opacity-60' : ''}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold">{group.name}</h3>
                          {isLocked && (
                            <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                              <svg
                                className="mr-1 inline h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                              Locked
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex gap-6 text-sm text-gray-600 dark:text-gray-400">
                          <div>
                            <span className="font-medium">{stats.totalWords}</span> words
                          </div>
                          <div>
                            <span className="font-medium">{stats.dueWords}</span> due today
                          </div>
                          <div>
                            <span className="font-medium">{group.completedSessions}</span> sessions
                          </div>
                          {stats.accuracy > 0 && (
                            <div>
                              <span className="font-medium">{stats.accuracy}%</span> accuracy
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {stats.accuracy > 0 && (
                          <div className="mt-4">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                              <div
                                className="h-full bg-green-500 transition-all"
                                style={{ width: `${stats.accuracy}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="ml-4">
                        {isLocked ? (
                          <Button variant="secondary" disabled>
                            Locked
                          </Button>
                        ) : stats.dueWords > 0 ? (
                          <Button
                            variant="primary"
                            onClick={() => handleStartDrill(group.id)}
                          >
                            Start Drill
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => handleStartDrill(group.id)}
                          >
                            Review Again
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Unlock criteria hint */}
                    {isLocked && (
                      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        Complete the previous group with 80% accuracy over 2 sessions to unlock
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
