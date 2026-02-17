'use client';

// CSV upload page

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SimpleHeader } from '@/components/SimpleHeader';
import { CSVUploader } from '@/components/CSVUploader';
import { useVocabStore } from '@/store/useVocabStore';
import { Button } from '@/components/ui/Button';

export default function UploadPage() {
  const router = useRouter();
  const { groups } = useVocabStore();

  // Redirect to dashboard if words are already uploaded
  useEffect(() => {
    if (groups.length > 0) {
      // Show upload page but add a back button
    }
  }, [groups.length]);

  return (
    <div className="min-h-screen bg-gray-900">
      <SimpleHeader />
      <main className="container mx-auto px-4 py-8 flex justify-center">
        <div className="w-full max-w-2xl space-y-6">
          {groups.length > 0 && (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                You already have vocabulary uploaded. Uploading a new CSV will replace your existing data.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => router.push('/')}
              >
                Back to Dashboard
              </Button>
            </div>
          )}

          <CSVUploader />
        </div>
      </main>
    </div>
  );
}
