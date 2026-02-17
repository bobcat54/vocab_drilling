// Smart CSV parser with auto-detection of Portuguese and English columns

import Papa from 'papaparse';
import type { CSVRow } from '@/types';

export interface ParsedData {
  rows: string[][];
  detectedMapping: {
    portugueseColumn: number;
    englishColumn: number;
    confidence: 'high' | 'medium' | 'low';
  };
  delimiter: string;
}

/**
 * Detect which column is Portuguese and which is English
 */
function detectLanguageColumns(rows: string[][]): {
  portugueseColumn: number;
  englishColumn: number;
  confidence: 'high' | 'medium' | 'low';
} {
  if (rows.length === 0 || rows[0].length < 2) {
    return { portugueseColumn: 0, englishColumn: 1, confidence: 'low' };
  }

  // Portuguese diacritics and common letter patterns
  const portuguesePatterns = /[ãáàâéêíóôõúüç]/i;
  const portugueseCommonWords = /(o|a|os|as|de|da|do|para|com|em|um|uma|não|sim|por|que|eu|você|ele|ela)/i;

  // Count Portuguese indicators in each column
  const col0Score = rows.slice(0, 10).reduce((score, row) => {
    if (!row[0]) return score;
    const text = row[0].toLowerCase();
    if (portuguesePatterns.test(text)) score += 2;
    if (portugueseCommonWords.test(text)) score += 1;
    return score;
  }, 0);

  const col1Score = rows.slice(0, 10).reduce((score, row) => {
    if (!row[1]) return score;
    const text = row[1].toLowerCase();
    if (portuguesePatterns.test(text)) score += 2;
    if (portugueseCommonWords.test(text)) score += 1;
    return score;
  }, 0);

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' = 'low';
  const scoreDiff = Math.abs(col0Score - col1Score);
  if (scoreDiff >= 5) confidence = 'high';
  else if (scoreDiff >= 2) confidence = 'medium';

  // Check headers as fallback
  const header0 = rows[0][0]?.toLowerCase() || '';
  const header1 = rows[0][1]?.toLowerCase() || '';

  if (header0.includes('port') || header0.includes('pt')) {
    return { portugueseColumn: 0, englishColumn: 1, confidence: 'high' };
  }
  if (header1.includes('port') || header1.includes('pt')) {
    return { portugueseColumn: 1, englishColumn: 0, confidence: 'high' };
  }
  if (header0.includes('eng') || header0.includes('en')) {
    return { portugueseColumn: 1, englishColumn: 0, confidence: 'high' };
  }
  if (header1.includes('eng') || header1.includes('en')) {
    return { portugueseColumn: 0, englishColumn: 1, confidence: 'high' };
  }

  // Use scores to determine
  if (col0Score > col1Score) {
    return { portugueseColumn: 0, englishColumn: 1, confidence };
  } else {
    return { portugueseColumn: 1, englishColumn: 0, confidence };
  }
}

/**
 * Detect the delimiter used in the file
 */
function detectDelimiter(content: string): string {
  const lines = content.split('\n').slice(0, 5);
  const delimiters = [',', '\t', ';', '|'];

  const scores = delimiters.map(delim => {
    const counts = lines.map(line => (line.match(new RegExp(`\\${delim}`, 'g')) || []).length);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / counts.length;
    return { delim, avg, variance };
  });

  // Prefer delimiter with highest average and lowest variance
  scores.sort((a, b) => {
    if (b.avg !== a.avg) return b.avg - a.avg;
    return a.variance - b.variance;
  });

  return scores[0].delim;
}

/**
 * Parse file content with smart detection
 */
export function parseCSV(content: string): ParsedData {
  // Detect delimiter
  const delimiter = detectDelimiter(content);

  // Parse with detected delimiter
  const result = Papa.parse(content, {
    delimiter,
    skipEmptyLines: true,
  });

  const rows = result.data as string[][];

  // Detect language columns
  const detectedMapping = detectLanguageColumns(rows);

  return {
    rows,
    detectedMapping,
    delimiter,
  };
}

/**
 * Convert parsed data to CSVRow format
 */
export function convertToCSVRows(
  parsedData: ParsedData,
  skipHeader: boolean = true
): CSVRow[] {
  const { rows, detectedMapping } = parsedData;
  const startIndex = skipHeader ? 1 : 0;

  return rows
    .slice(startIndex)
    .filter(row => row.length >= 2 && row[0] && row[1])
    .map(row => ({
      portuguese: row[detectedMapping.portugueseColumn]?.trim() || '',
      english: row[detectedMapping.englishColumn]?.trim() || '',
    }))
    .filter(row => row.portuguese && row.english);
}

/**
 * Check if first row looks like a header
 */
export function hasHeader(rows: string[][]): boolean {
  if (rows.length === 0) return false;

  const firstRow = rows[0];
  const secondRow = rows[1];

  if (!secondRow) return false;

  // Check if first row contains header keywords
  const headerKeywords = /(portuguese|english|português|inglês|pt|en|word|palavra)/i;
  const hasKeywords = firstRow.some(cell => headerKeywords.test(cell));

  if (hasKeywords) return true;

  // Check if first row is significantly different from second row
  const firstRowLength = firstRow.join('').length;
  const secondRowLength = secondRow.join('').length;
  const lengthDiff = Math.abs(firstRowLength - secondRowLength) / Math.max(firstRowLength, secondRowLength);

  return lengthDiff > 0.5;
}
