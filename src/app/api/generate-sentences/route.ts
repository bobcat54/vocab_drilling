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
    const { portuguese, english } = await request.json();

    if (!portuguese || !english) {
      return NextResponse.json(
        { error: 'Missing portuguese or english field' },
        { status: 400 }
      );
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `Generate 3 short, natural European Portuguese (PT-PT) sentences using the word '${portuguese}' (English: ${english}). Rules:
- Use European Portuguese grammar (e.g. 'estou a fazer' not 'estou fazendo', 'tu' not 'você')
- Each sentence should be 4-8 words long
- The sentences must make natural sense with this specific word
- Each sentence MUST contain the exact word '${portuguese}'
- Return ONLY the sentences, one per line, no numbering`,
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
    console.log('Anthropic response for', portuguese, ':', JSON.stringify(data, null, 2));
    const text = data.content[0]?.text || '';
    const sentences = text
      .split('\n')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    return NextResponse.json({ sentences });
  } catch (error) {
    console.error('Error generating sentences:', error);
    return NextResponse.json(
      { error: 'Failed to generate sentences' },
      { status: 500 }
    );
  }
}
