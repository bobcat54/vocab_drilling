'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { migrateLocalStorageToSupabase } from '@/lib/migrate-to-supabase';
import { useVocabStore } from '@/store/useVocabStore';
import { LoginScreen } from './LoginScreen';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'authenticated'>('loading');
  const [dataReady, setDataReady] = useState(false);
  const loadFromSupabase = useVocabStore((s) => s.loadFromSupabase);
  const dataLoaded = useVocabStore((s) => s.dataLoaded);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(session ? 'authenticated' : 'unauthenticated');
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(session ? 'authenticated' : 'unauthenticated');
      if (!session) {
        setDataReady(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load data once authenticated
  useEffect(() => {
    if (authState !== 'authenticated' || dataLoaded) return;

    const load = async () => {
      // Run migration if localStorage has data
      if (typeof window !== 'undefined' && localStorage.getItem('vocab-storage')) {
        try {
          await migrateLocalStorageToSupabase();
        } catch (err) {
          console.error('[AuthGuard] Migration error:', err);
        }
      }

      await loadFromSupabase();
      setDataReady(true);
    };

    load();
  }, [authState, dataLoaded, loadFromSupabase]);

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-cyan-500" />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <LoginScreen />;
  }

  // Authenticated but data not yet loaded
  if (!dataReady && !dataLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 mx-auto animate-spin rounded-full border-4 border-gray-600 border-t-cyan-500" />
          <p className="text-gray-400">Loading your data...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
