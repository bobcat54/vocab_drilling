// Keyword-based word grouping algorithm
// Groups vocabulary words into themed sets of ~15 words

import type { WordGroup, CSVRow } from '@/types';

// Theme keywords for categorizing words
const THEME_KEYWORDS: Record<string, string[]> = {
  'Food & Cooking': [
    'food', 'eat', 'cook', 'meal', 'kitchen', 'restaurant', 'dish', 'ingredient',
    'bread', 'meat', 'fruit', 'vegetable', 'drink', 'coffee', 'tea', 'water',
    'breakfast', 'lunch', 'dinner', 'hungry', 'taste', 'delicious', 'spicy', 'sweet',
  ],
  'Travel & Transport': [
    'travel', 'trip', 'car', 'bus', 'train', 'plane', 'airport', 'hotel', 'road',
    'vacation', 'journey', 'ticket', 'passport', 'luggage', 'map', 'drive', 'fly',
    'station', 'destination', 'tourist', 'visit', 'explore',
  ],
  'Home & Family': [
    'home', 'house', 'family', 'mother', 'father', 'child', 'room', 'furniture',
    'bed', 'table', 'chair', 'door', 'window', 'wall', 'floor', 'roof',
    'parent', 'brother', 'sister', 'son', 'daughter', 'husband', 'wife',
  ],
  'Work & Business': [
    'work', 'job', 'office', 'business', 'company', 'meeting', 'money', 'boss',
    'employee', 'colleague', 'salary', 'career', 'project', 'deadline', 'client',
    'computer', 'desk', 'email', 'schedule', 'professional',
  ],
  'Health & Body': [
    'health', 'body', 'doctor', 'hospital', 'medicine', 'pain', 'sick', 'ill',
    'head', 'hand', 'foot', 'eye', 'ear', 'mouth', 'nose', 'arm', 'leg',
    'heart', 'stomach', 'tooth', 'blood', 'injury', 'healthy',
  ],
  'Emotions & Feelings': [
    'feel', 'happy', 'sad', 'angry', 'love', 'hate', 'emotion', 'mood',
    'joy', 'fear', 'worry', 'excited', 'nervous', 'surprised', 'disappointed',
    'proud', 'ashamed', 'grateful', 'lonely', 'comfortable',
  ],
  'Time & Calendar': [
    'time', 'day', 'week', 'month', 'year', 'hour', 'minute', 'second', 'today',
    'tomorrow', 'yesterday', 'morning', 'afternoon', 'evening', 'night',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december', 'clock', 'calendar', 'date',
  ],
  'Nature & Weather': [
    'weather', 'rain', 'sun', 'tree', 'flower', 'animal', 'nature', 'cloud',
    'wind', 'snow', 'storm', 'hot', 'cold', 'warm', 'cool', 'forest',
    'mountain', 'river', 'sea', 'ocean', 'lake', 'beach', 'sky', 'star',
  ],
  'Colors & Appearance': [
    'color', 'red', 'blue', 'green', 'yellow', 'black', 'white', 'orange',
    'purple', 'pink', 'brown', 'gray', 'big', 'small', 'tall', 'short',
    'beautiful', 'ugly', 'pretty', 'bright', 'dark', 'light', 'heavy',
  ],
  'Numbers & Quantities': [
    'number', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
    'nine', 'ten', 'many', 'few', 'some', 'all', 'none', 'most', 'several',
    'enough', 'too', 'more', 'less', 'half', 'quarter', 'double',
  ],
  'Education & Learning': [
    'school', 'student', 'teacher', 'study', 'learn', 'book', 'read', 'write',
    'class', 'lesson', 'homework', 'test', 'exam', 'university', 'college',
    'subject', 'math', 'science', 'history', 'language',
  ],
  'Clothing & Fashion': [
    'clothes', 'shirt', 'pants', 'dress', 'shoes', 'hat', 'coat', 'jacket',
    'wear', 'fashion', 'style', 'size', 'fit', 'color', 'pattern',
  ],
};

/**
 * Calculate theme scores for a word based on keyword matching
 */
function calculateThemeScores(word: CSVRow): Record<string, number> {
  const scores: Record<string, number> = {};
  const englishLower = word.english.toLowerCase();

  Object.entries(THEME_KEYWORDS).forEach(([theme, keywords]) => {
    let score = 0;
    keywords.forEach(keyword => {
      // Exact word match (higher score)
      const wordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (wordRegex.test(englishLower)) {
        score += 2;
      }
      // Partial match (lower score)
      else if (englishLower.includes(keyword)) {
        score += 1;
      }
    });
    scores[theme] = score;
  });

  return scores;
}

/**
 * Get the best matching theme for a word
 */
function getBestTheme(scores: Record<string, number>): string {
  let bestTheme = 'General';
  let bestScore = 0;

  Object.entries(scores).forEach(([theme, score]) => {
    if (score > bestScore) {
      bestScore = score;
      bestTheme = theme;
    }
  });

  // If no keywords matched, use "General" theme
  return bestScore > 0 ? bestTheme : 'General';
}

/**
 * Group words by theme using keyword matching
 *
 * @param csvData - Array of word pairs from CSV
 * @returns Array of word groups with ~15 words each
 */
export function groupWords(csvData: CSVRow[]): WordGroup[] {
  // Calculate theme for each word
  const wordsWithThemes = csvData.map(word => {
    const scores = calculateThemeScores(word);
    const theme = getBestTheme(scores);
    return { word, theme, score: scores[theme] || 0 };
  });

  // Group by theme
  const themeMap = new Map<string, typeof wordsWithThemes>();
  wordsWithThemes.forEach(item => {
    const existing = themeMap.get(item.theme) || [];
    existing.push(item);
    themeMap.set(item.theme, existing);
  });

  // Create WordGroup objects with ~15 words each
  const groups: WordGroup[] = [];
  const WORDS_PER_GROUP = 15;

  themeMap.forEach((themeWords, theme) => {
    // Sort by score (best matches first)
    themeWords.sort((a, b) => b.score - a.score);

    // Split into chunks of 15
    for (let i = 0; i < themeWords.length; i += WORDS_PER_GROUP) {
      const chunk = themeWords.slice(i, i + WORDS_PER_GROUP);
      const groupNumber = Math.floor(i / WORDS_PER_GROUP) + 1;
      const groupName = themeWords.length > WORDS_PER_GROUP
        ? `${theme} ${groupNumber}`
        : theme;

      groups.push({
        id: crypto.randomUUID(),
        name: groupName,
        theme,
        wordIds: [], // Will be populated when words are created
        isUnlocked: groups.length === 0, // First group is unlocked by default
        completedSessions: 0,
        accuracy: 0,
        createdAt: new Date().toISOString(),
      });
    }
  });

  // Sort groups by theme name for consistent ordering
  groups.sort((a, b) => {
    // First unlocked group first
    if (a.isUnlocked && !b.isUnlocked) return -1;
    if (!a.isUnlocked && b.isUnlocked) return 1;
    // Then alphabetically
    return a.name.localeCompare(b.name);
  });

  // Ensure first group is unlocked
  if (groups.length > 0) {
    groups[0].isUnlocked = true;
  }

  return groups;
}

/**
 * Assign words to groups based on theme matching
 *
 * @param csvData - Array of word pairs
 * @param groups - Array of word groups
 * @returns Map of group IDs to their words
 */
export function assignWordsToGroups(
  csvData: CSVRow[],
  groups: WordGroup[]
): Map<string, CSVRow[]> {
  const wordsWithThemes = csvData.map(word => {
    const scores = calculateThemeScores(word);
    const theme = getBestTheme(scores);
    return { word, theme };
  });

  const groupMap = new Map<string, CSVRow[]>();
  const WORDS_PER_GROUP = 15;

  // Group words by theme
  const themeMap = new Map<string, CSVRow[]>();
  wordsWithThemes.forEach(({ word, theme }) => {
    const existing = themeMap.get(theme) || [];
    existing.push(word);
    themeMap.set(theme, existing);
  });

  // Assign to groups
  groups.forEach(group => {
    const themeWords = themeMap.get(group.theme) || [];
    const lastToken = group.name.split(' ').pop() || '';
    const parsed = parseInt(lastToken);
    // For single-group themes the name has no numeric suffix (e.g. "Food & Cooking"),
    // so parseInt returns NaN. Default to index 0 in that case.
    const groupIndex = isNaN(parsed) ? 0 : parsed - 1;
    const start = groupIndex * WORDS_PER_GROUP;
    const end = start + WORDS_PER_GROUP;
    const words = themeWords.slice(start, end);
    groupMap.set(group.id, words);
  });

  return groupMap;
}
