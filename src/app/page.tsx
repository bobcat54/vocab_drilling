'use client';

// Home/Dashboard page

import { SimpleHeader } from '@/components/SimpleHeader';
import { ProgressDashboard } from '@/components/ProgressDashboard';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <SimpleHeader />
      <main className="container mx-auto px-4 py-8 flex justify-center">
        <ProgressDashboard />
      </main>
    </div>
  );
}
