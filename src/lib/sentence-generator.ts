// Sentence generation: API-based with template fallback

import type { CSVRow } from '@/types';

// Fallback templates for when the API is unavailable
const FALLBACK_TEMPLATES = [
  'Eu preciso de WORD.',
  'WORD é muito importante.',
  'Onde está o WORD?',
  'Tu viste o WORD?',
  'Eu comprei um WORD novo.',
  'Eu gosto de WORD.',
  'Nós precisamos de WORD.',
  'Ela mencionou WORD.',
  'Eu aprendi sobre WORD.',
  'Tu conheces WORD?',
  'WORD está aqui.',
  'Eu lembro-me de WORD.',
];

/**
 * Generate fallback sentences using simple templates (no API needed)
 */
export function generateFallbackSentences(word: CSVRow): string[] {
  const shuffled = [...FALLBACK_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(t => t.replace('WORD', word.portuguese));
}

/**
 * Generate sentences for a single word via the API route
 */
async function generateSentencesForWord(word: CSVRow): Promise<string[]> {
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('/api/generate-sentences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portuguese: word.portuguese,
          english: word.english,
        }),
      });

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          console.warn(`Rate limited for "${word.portuguese}", retrying in 3s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        throw new Error('Rate limited after retries');
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      if (data.sentences && data.sentences.length > 0) {
        return data.sentences;
      }
      throw new Error('No sentences returned');
    } catch (error) {
      if (attempt < MAX_RETRIES && error instanceof Error && error.message === 'Rate limited after retries') {
        // Already handled above, fall through to fallback
      } else if (attempt < MAX_RETRIES) {
        continue;
      }
      console.warn(`API generation failed for "${word.portuguese}", using fallback:`, error);
      return generateFallbackSentences(word);
    }
  }

  return generateFallbackSentences(word);
}

/**
 * Generate sentences for all words, with concurrent API calls and progress reporting.
 * Returns a Map keyed by Portuguese word.
 */
export async function generateAllSentences(
  words: CSVRow[],
  onProgress?: (current: number, total: number) => void
): Promise<Record<string, string[]>> {
  const results: Record<string, string[]> = {};
  const CONCURRENCY = 2;

  for (let i = 0; i < words.length; i += CONCURRENCY) {
    const batch = words.slice(i, Math.min(i + CONCURRENCY, words.length));

    const batchResults = await Promise.all(
      batch.map(word => generateSentencesForWord(word))
    );

    batch.forEach((word, j) => {
      results[word.portuguese] = batchResults[j];
    });

    onProgress?.(Math.min(i + CONCURRENCY, words.length), words.length);

    if (i + CONCURRENCY < words.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
