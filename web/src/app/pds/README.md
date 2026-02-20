# PDS - Product Data Science Training

An interactive learning application for product data science skills, built with Next.js App Router.

## Route Structure

```
/pds                          - Landing page with program overview
/pds/modules                  - All modules listing
/pds/modules/[moduleSlug]     - Individual module with lessons
/pds/modules/[moduleSlug]/[lessonSlug] - Lesson content
/pds/progress                 - User progress dashboard
```

## Adding New Modules & Lessons

All content is defined in `/src/lib/pds/content.ts`.

### Add a New Module

```typescript
// In content.ts, add to the modules array:
{
  slug: 'my-new-module',           // URL-safe identifier
  title: 'My New Module',          // Display title
  description: 'What this module covers',
  weekRange: 'Week 5-6',           // Roadmap position
  icon: '📈',                       // Emoji icon
  lessons: [...]                   // Array of lessons
}
```

### Add a New Lesson

```typescript
// Inside a module's lessons array:
{
  slug: 'my-lesson',               // URL-safe identifier
  title: 'My Lesson Title',
  description: 'Brief description',
  estimatedMinutes: 15,            // Reading time estimate
  blocks: [                        // Content blocks (see below)
    { type: 'text', content: '## Heading\n\nParagraph text...' },
    // ... more blocks
  ]
}
```

## Content Block Types

### Text Block
Supports markdown-like syntax (headers, bold, inline code, lists, tables, code blocks).

```typescript
{
  type: 'text',
  content: `## My Heading

This is a paragraph with **bold** text and \`inline code\`.

- List item 1
- List item 2

\`\`\`
code block
\`\`\`
`
}
```

### Multiple Choice Quiz
```typescript
{
  type: 'quiz',
  id: 'unique-quiz-id',           // Must be unique within lesson
  question: 'What is the answer?',
  multiSelect: false,             // true for "select all that apply"
  options: [
    { id: 'a', text: 'Option A', isCorrect: false },
    { id: 'b', text: 'Option B', isCorrect: true },
    { id: 'c', text: 'Option C', isCorrect: false },
  ],
  explanation: 'Optional explanation shown after answering'
}
```

### Quick Check (True/False)
```typescript
{
  type: 'quickcheck',
  id: 'unique-check-id',
  statement: 'The sky is blue.',
  isTrue: true,
  explanation: 'Optional explanation'
}
```

### Flashcards
```typescript
{
  type: 'flashcards',
  id: 'unique-flashcards-id',
  cards: [
    { front: 'Question 1', back: 'Answer 1' },
    { front: 'Question 2', back: 'Answer 2' },
  ]
}
```

### MicroSim (Interactive Simulation)
```typescript
{
  type: 'microsim',
  id: 'unique-sim-id',
  simType: 'sampling-distribution', // or 'confidence-interval' or 'power-curve'
  title: 'Simulation Title',
  description: 'Optional description'
}
```

Available simulation types:
- `sampling-distribution` - Shows distribution of sample proportions
- `confidence-interval` - Shows CI coverage across many samples
- `power-curve` - (Coming soon)

To add a new simulation type:
1. Add the type to `MicroSimBlock['simType']` in `/src/lib/pds/types.ts`
2. Create a new component in `/src/app/pds/components/MicroSim.tsx`

### Memo (Decision Notes)
```typescript
{
  type: 'memo',
  id: 'unique-memo-id',
  prompt: 'Reflect on what you learned...'
}
```

## Progress Persistence

Progress is stored in localStorage under the key `pds-progress`. The data model supports:

- Lesson completion status
- Quiz/QuickCheck answers
- Flashcard viewed states
- User memos/notes
- Streak tracking (consecutive days)

See `/src/lib/pds/progress-store.ts` for the full API.

## Styling

Uses Tailwind CSS following the site's dark theme:
- Background: `zinc-950`, `zinc-900`
- Text: `white`, `zinc-300`, `zinc-400`
- Accent: `blue-600`, `green-600`, `amber-600`
- Borders: `zinc-800`, `zinc-700`

## File Structure

```
/src/app/pds/
├── layout.tsx              # Shared layout with sidebar/bottom nav
├── page.tsx                # Landing page
├── progress/page.tsx       # Progress dashboard
├── modules/
│   ├── page.tsx            # Modules listing
│   ├── [moduleSlug]/
│   │   ├── page.tsx        # Individual module
│   │   └── [lessonSlug]/
│   │       └── page.tsx    # Lesson content
├── components/
│   ├── LessonRenderer.tsx  # Main lesson display
│   ├── TextBlock.tsx       # Markdown-like text rendering
│   ├── MultipleChoiceQuiz.tsx
│   ├── QuickCheck.tsx
│   ├── Flashcards.tsx
│   ├── MicroSim.tsx        # Interactive simulations
│   └── MemoPanel.tsx       # User notes
└── README.md               # This file

/src/lib/pds/
├── types.ts                # TypeScript type definitions
├── content.ts              # Module & lesson definitions
└── progress-store.ts       # localStorage persistence
```

## Mobile Considerations

- Bottom navigation on mobile, sidebar on desktop
- Touch-friendly interactive components
- Flashcards support swipe gestures
- Simulations capped to prevent phone overheating
