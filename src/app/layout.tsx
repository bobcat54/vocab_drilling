import type { Metadata, Viewport } from 'next';
import { ThemeToggle } from '@/components/ThemeToggle';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Portuguese Vocab Driller',
  description: 'Spaced repetition vocabulary drilling for Portuguese',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VocabDrill',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="min-h-screen bg-gray-900">
        {children}
      </body>
    </html>
  );
}
