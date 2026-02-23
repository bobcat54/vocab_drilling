// Sentence generation: batched API calls with template fallback

import type { CSVRow } from '@/types';

const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 3000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

// Fallback templates for when the API is unavailable
const FALLBACK_TEMPLATES: { pt: string; en: string }[] = [
  { pt: 'Eu preciso de WORD_PT.', en: 'I need WORD_EN.' },
  { pt: 'WORD_PT é muito importante.', en: 'WORD_EN is very important.' },
  { pt: 'Onde está o WORD_PT?', en: 'Where is the WORD_EN?' },
  { pt: 'Tu viste o WORD_PT?', en: 'Did you see the WORD_EN?' },
  { pt: 'Eu comprei um WORD_PT novo.', en: 'I bought a new WORD_EN.' },
  { pt: 'Eu gosto de WORD_PT.', en: 'I like WORD_EN.' },
  { pt: 'Nós precisamos de WORD_PT.', en: 'We need WORD_EN.' },
  { pt: 'Ela mencionou WORD_PT.', en: 'She mentioned WORD_EN.' },
  { pt: 'Eu aprendi sobre WORD_PT.', en: 'I learned about WORD_EN.' },
  { pt: 'Tu conheces WORD_PT?', en: 'Do you know WORD_EN?' },
  { pt: 'WORD_PT está aqui.', en: 'WORD_EN is here.' },
  { pt: 'Eu lembro-me de WORD_PT.', en: 'I remember WORD_EN.' },
];

/**
 * Generate fallback sentences using simple templates (no API needed)
 */
export function generateFallbackSentences(word: CSVRow): { pt: string; en: string }[] {
  const shuffled = [...FALLBACK_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(t => ({
    pt: t.pt.replace('WORD_PT', word.portuguese),
    en: t.en.replace('WORD_EN', word.english),
  }));
}

/**
 * Send a batch of words to the API and return a map of Portuguese word → sentences.
 * Retries on 429 rate-limit errors.
 */
async function generateSentencesForBatch(
  batch: CSVRow[]
): Promise<Record<string, { pt: string; en: string }[]>> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('/api/generate-sentences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: batch.map(w => ({ portuguese: w.portuguese, english: w.english })),
        }),
      });

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          console.warn(
            `Rate limited on batch of ${batch.length} words, retrying in ${RETRY_DELAY_MS / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})...`
          );
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
        throw new Error('Rate limited after retries');
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      const apiResults: Record<string, { pt: string; en: string }[]> = data.results || {};

      // For any word missing from the API response or with no sentences,
      // fall back to templates for just that word.
      const results: Record<string, { pt: string; en: string }[]> = {};
      for (const word of batch) {
        const sentences = apiResults[word.portuguese];
        if (sentences && sentences.length > 0) {
          results[word.portuguese] = sentences;
        } else {
          console.warn(`No API sentences for "${word.portuguese}", using fallback`);
          results[word.portuguese] = generateFallbackSentences(word);
        }
      }

      return results;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        console.warn(`Batch API call failed (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
        continue;
      }
      // All retries exhausted — fall back to templates for the entire batch
      console.warn('Batch API call failed after retries, using fallback for all words:', error);
      const results: Record<string, { pt: string; en: string }[]> = {};
      for (const word of batch) {
        results[word.portuguese] = generateFallbackSentences(word);
      }
      return results;
    }
  }

  // Should not reach here, but satisfy TypeScript
  const results: Record<string, { pt: string; en: string }[]> = {};
  for (const word of batch) {
    results[word.portuguese] = generateFallbackSentences(word);
  }
  return results;
}

/**
 * Generate sentences for all words in batches of up to 50, with progress reporting.
 * Returns a map keyed by Portuguese word.
 */
export async function generateAllSentences(
  words: CSVRow[],
  onProgress?: (current: number, total: number) => void
): Promise<Record<string, { pt: string; en: string }[]>> {
  const results: Record<string, { pt: string; en: string }[]> = {};

  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, Math.min(i + BATCH_SIZE, words.length));

    const batchResults = await generateSentencesForBatch(batch);

    // Merge batch results into overall results
    Object.assign(results, batchResults);

    onProgress?.(Math.min(i + batch.length, words.length), words.length);

    // Delay between batches (skip after the last one)
    if (i + BATCH_SIZE < words.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  return results;
}
