import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-api-key-here') {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured in .env.local' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const words: Array<{ portuguese: string; english: string }> = body.words;

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty words array' },
        { status: 400 }
      );
    }

    // Build the numbered word list for the prompt
    const wordList = words
      .map((w, i) => `${i + 1}. ${w.portuguese} (English: ${w.english})`)
      .join('\n');

    const prompt = `Generate 3 European Portuguese (PT-PT) sentences for each of these words, with English translations. Each sentence should be 4-8 words long and use natural PT-PT grammar (e.g. 'estou a fazer' not 'estou fazendo', 'tu' not 'você'). Each sentence MUST contain the exact Portuguese word listed.

CRITICAL: Each sentence MUST contain the EXACT word as written in the list — do not conjugate verbs, do not change gender/number agreement, do not use a different form. For example, if the word is 'académico', write 'académico' not 'académica'. The sentence can be slightly unnatural if needed — using the exact word form is more important than perfect grammar.

Words:
${wordList}

Return in this exact format (PT line followed by EN translation):

[${words[0].portuguese}]
PT: Portuguese sentence 1
EN: English translation 1
PT: Portuguese sentence 2
EN: English translation 2
PT: Portuguese sentence 3
EN: English translation 3

[${words.length > 1 ? words[1].portuguese : words[0].portuguese}]
PT: Portuguese sentence 1
EN: English translation 1
PT: Portuguese sentence 2
EN: English translation 2
PT: Portuguese sentence 3
EN: English translation 3

...`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Anthropic API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const text: string = data.content[0]?.text || '';

    // Parse the batched response: look for [word] headers followed by PT:/EN: pairs
    const results: Record<string, { pt: string; en: string }[]> = {};
    let currentWord: string | null = null;
    let pendingPt: string | null = null;
    const headerPattern = /^\[(.+)\]$/;

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const headerMatch = trimmed.match(headerPattern);
      if (headerMatch) {
        currentWord = headerMatch[1];
        pendingPt = null;
        if (!results[currentWord]) {
          results[currentWord] = [];
        }
      } else if (currentWord) {
        // Strip leading numbering like "1. " or "- "
        const cleaned = trimmed.replace(/^\d+[\.\)]\s*/, '').replace(/^[-–—]\s*/, '');

        if (cleaned.match(/^PT:\s*/i)) {
          pendingPt = cleaned.replace(/^PT:\s*/i, '');
        } else if (cleaned.match(/^EN:\s*/i) && pendingPt) {
          const en = cleaned.replace(/^EN:\s*/i, '');
          results[currentWord].push({ pt: pendingPt, en });
          pendingPt = null;
        } else if (cleaned.length > 0 && !pendingPt) {
          // Fallback: line without PT:/EN: prefix — treat as PT-only
          results[currentWord].push({ pt: cleaned, en: '' });
        }
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error generating sentences:', error);
    return NextResponse.json(
      { error: 'Failed to generate sentences' },
      { status: 500 }
    );
  }
}
