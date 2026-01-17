# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

S2 is a password-protected personal web application for managing various automation tasks. The first feature is a crypto day trading bot. The entire app is behind authentication - only the login page is publicly accessible.

## Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Auth**: Supabase Auth (email/password)
- **Deployment**: Vercel

## Commands

```bash
npm run dev       # Start development server (port 3000)
npm run build     # Production build
npm run lint      # Run ESLint
npm start         # Start production server
```

## Project Structure

```
/web
├── src/
│   ├── app/
│   │   ├── (auth)/           # Public auth pages (login only)
│   │   ├── (dashboard)/      # Protected app routes
│   │   │   └── trading/      # Crypto trading bot interface
│   │   └── api/              # API routes
│   ├── components/           # React components
│   ├── lib/
│   │   ├── supabase/         # Supabase clients (client.ts, server.ts)
│   │   ├── auth.ts           # Auth utilities
│   │   └── validators.ts     # Zod schemas
│   └── types/
│       └── database.ts       # Supabase-generated types
└── supabase/
    ├── schema.sql            # Database schema
    └── rls-policies.sql      # Row Level Security policies
```

## Architecture Patterns

### Authentication
- All routes except `(auth)/*` require authentication
- Use `requireAuth()` from `lib/auth.ts` in API routes
- Server components use `createClient()` from `lib/supabase/server.ts`
- Client components use `createClient()` from `lib/supabase/client.ts`

### API Routes
```typescript
// Standard pattern for protected API routes
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const user = await requireAuth()  // Throws if not authenticated
  const supabase = await createClient()
  // ... database operations
}
```

### Validation
- Use Zod schemas in `lib/validators.ts` for all API inputs
- Validate with `.parse()` which throws on invalid input

### Database Access
- Always filter queries by `user_id` for user-specific data
- RLS policies provide additional security layer
- Use TypeScript types from `types/database.ts`

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Single-User Design

Unlike multi-tenant apps, this is a single-user application. Authentication exists for security (password protection), not multi-tenancy. Database tables use `user_id` for ownership but there's only one user.
