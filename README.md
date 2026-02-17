# Portuguese Vocabulary Drilling PWA

A mobile-first Next.js Progressive Web App for learning Portuguese vocabulary using spaced repetition (SM-2 algorithm). Features Lingvist-style immersive UI and smart CSV parsing with auto-detection.

## Features

- **Smart CSV Upload**: Auto-detects Portuguese/English columns, handles multiple delimiters (comma, tab, semicolon), preview before import
- **Intelligent Grouping**: Automatically groups words into themed sets (~15 words each) using keyword matching
- **Template-Based Examples**: Generates multiple English example sentences per word using templates
- **Spaced Repetition**: Uses SM-2 algorithm for optimal review scheduling
- **Progressive Unlocking**: Master one group to unlock the next (80% accuracy over 2 sessions)
- **Lingvist-Style UI**: Dark immersive interface with cyan highlights, letter hints, and minimal distractions
- **Offline-First**: All data stored in browser localStorage - no external API calls
- **PWA Support**: Install on mobile devices, works completely offline
- **Mobile-Optimized**: Touch-friendly interface designed for mobile learning

## Tech Stack

- **Framework**: Next.js 15 with App Router, TypeScript
- **Styling**: Tailwind CSS (dark mode, cyan accents)
- **Animations**: Framer Motion (feedback, transitions)
- **State Management**: Zustand with localStorage persistence
- **PWA**: @ducanh2912/next-pwa
- **Data Processing**: papaparse (CSV parsing)
- **Utilities**: date-fns, clsx

## Getting Started

### Prerequisites

- Node.js 20.0.0 or higher
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
npm start
```

## Usage

### 1. Upload Vocabulary

Navigate to **Upload** and either:
- Upload a CSV/TSV file (any delimiter)
- Paste text directly into the text area

The app will:
- Auto-detect which column is Portuguese vs English
- Show a preview with detected mapping
- Let you confirm before importing

Example formats:
```csv
portuguese,english
olá,hello
obrigado,thank you
bom dia,good morning
comida,food
```

The app will:
- Parse the CSV
- Group words by theme (Food, Travel, Home, etc.)
- Generate example sentences using AI
- Store everything in localStorage

### 2. Start Drilling

From the **Dashboard**, click "Start Drill" on an unlocked group. You'll see:
- An example sentence with the English word highlighted
- An input field to type the Portuguese translation
- Immediate feedback (green for correct, red for incorrect)
- Progress indicator

### 3. Track Progress

View your statistics on the **Progress** page:
- Total words learned
- Overall accuracy percentage
- Session history with detailed results
- Group completion status

### 4. Unlock New Groups

Complete 2 drilling sessions with 80%+ accuracy to unlock the next group.

## Project Structure

```
vocab_drilling/
├── public/
│   ├── icons/              # PWA icons
│   └── manifest.json       # PWA manifest
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Dashboard (home)
│   │   ├── upload/         # CSV upload page
│   │   ├── drill/          # Drilling session page
│   │   ├── progress/       # Progress statistics
│   │   └── globals.css     # Global styles
│   ├── components/
│   │   ├── ui/             # Base UI components
│   │   ├── CSVUploader.tsx
│   │   ├── DrillCard.tsx
│   │   ├── ProgressDashboard.tsx
│   │   └── ThemeToggle.tsx
│   ├── lib/
│   │   ├── storage.ts          # localStorage abstraction
│   │   ├── sm2-algorithm.ts    # Spaced repetition
│   │   ├── word-grouping.ts    # Theme-based grouping
│   │   ├── sentence-generator.ts # AI sentence generation
│   │   └── utils.ts
│   ├── store/
│   │   └── useVocabStore.ts    # Zustand state management
│   └── types/
│       └── index.ts            # TypeScript definitions
├── next.config.js
├── tailwind.config.ts
└── package.json
```

## Data Models

### Word
- Portuguese and English translations
- Example sentence (AI-generated)
- SM-2 parameters (easiness factor, interval, repetitions)
- Statistics (times seen, times correct)

### WordGroup
- Theme name (e.g., "Food & Cooking")
- ~15 words
- Unlock status
- Completion stats and accuracy

### DrillSession
- Group ID
- Word results (answers, correctness)
- Session accuracy

## SM-2 Algorithm

The app uses the SuperMemo 2 algorithm for spaced repetition:

- **Correct answers**: Increase interval (1 day → 6 days → exponential growth)
- **Incorrect answers**: Reset to 1-day interval
- **Easiness factor**: Adjusts based on answer quality (1.3-2.5)

Words are scheduled for review based on their next review date.

## PWA Configuration

To enable full PWA functionality:

1. **Icons**: Add proper app icons to `public/icons/`:
   - `icon-192x192.png`
   - `icon-512x512.png`

2. **Build for production**: PWA features are disabled in development mode

3. **Install**: On mobile browsers, use "Add to Home Screen"

## Development

### Key Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

### Adding New Features

1. **New library function**: Add to `src/lib/`
2. **New component**: Add to `src/components/`
3. **New page**: Add to `src/app/`
4. **State changes**: Update `src/store/useVocabStore.ts`

## Troubleshooting

### API Key Issues
If example sentences aren't generating:
- Check that `NEXT_PUBLIC_ANTHROPIC_API_KEY` is set in `.env.local`
- Verify your API key is valid
- Check browser console for errors
- The app will use fallback sentences if AI generation fails

### localStorage Full
If you see storage errors:
- Clear browser data for localhost
- Or use the "Clear All Data" button (to be added in settings)

### PWA Not Installing
- PWA features only work in production builds
- Icons must be present in `public/icons/`
- Use HTTPS in production (localhost works for development)

## Contributing

This is an early-stage project. Contributions welcome!

## License

MIT

## Acknowledgments

- **SM-2 Algorithm**: SuperMemo 2 by Piotr Woźniak
- **AI Sentences**: Powered by Anthropic Claude API
