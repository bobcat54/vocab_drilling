'use client';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export function SimpleHeader() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="border-b border-gray-800 bg-gray-800/50">
      <div className="container mx-auto flex items-center justify-between px-4 py-4 max-w-4xl">
        <Link href="/" className="text-2xl font-bold text-cyan-400">
          VocabDrill
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-100 transition-colors text-sm"
          >
            Dashboard
          </Link>
          <Link
            href="/upload"
            className="text-gray-400 hover:text-gray-100 transition-colors text-sm"
          >
            Upload
          </Link>
          <Link
            href="/progress"
            className="text-gray-400 hover:text-gray-100 transition-colors text-sm"
          >
            Progress
          </Link>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-400 transition-colors text-sm"
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
