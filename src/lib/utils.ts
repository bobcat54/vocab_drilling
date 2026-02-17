// Utility functions

import { type ClassValue, clsx } from 'clsx';

/**
 * Merge class names with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Normalize a string for comparison (lowercase, trim, remove accents)
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

/**
 * Compare two strings for equality (case-insensitive, accent-insensitive)
 */
export function compareStrings(a: string, b: string): boolean {
  return normalizeString(a) === normalizeString(b);
}

/**
 * Check if answer is a near-match (correct without accents, but accents are different)
 * Returns true if the normalized strings match but the original strings don't
 */
export function isNearMatch(userAnswer: string, correctAnswer: string): boolean {
  const normalizedMatch = normalizeString(userAnswer) === normalizeString(correctAnswer);
  const exactMatch = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  return normalizedMatch && !exactMatch;
}

/**
 * Get the missing accent/diacritic characters between user answer and correct answer
 * For showing feedback like "Almost! Watch the accent: á"
 */
export function getAccentDifference(userAnswer: string, correctAnswer: string): string {
  const userChars = userAnswer.toLowerCase().trim().split('');
  const correctChars = correctAnswer.toLowerCase().trim().split('');

  if (userChars.length !== correctChars.length) return '';

  for (let i = 0; i < correctChars.length; i++) {
    if (userChars[i] !== correctChars[i]) {
      // Found the character with different accent
      return correctChars[i];
    }
  }

  return '';
}

/**
 * Calculate accuracy percentage
 */
export function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

/**
 * Format a date as a readable string
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get a random item from an array
 */
export function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffle an array (Fisher-Yates algorithm)
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
