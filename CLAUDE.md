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

## Crypto Trading Bot (Solana Scalping)

### Overview

Semi-automated scalping bot for Solana tokens:
1. User provides token mint address
2. Bot fetches token details and current price via Jupiter
3. Dashboard shows trading plan with stop-loss/take-profit levels
4. User approves the plan
5. Vercel cron monitors price and executes when triggers hit

### External APIs

**Jupiter Aggregator** - Solana DEX aggregator (price data + trade execution)
- Docs: https://dev.jup.ag
- Free tier: 60 requests/minute (requires free API key)
- Handles both quotes AND swap execution

Key endpoints:
```
GET  /search?query={symbol}           # Find token by symbol/mint
POST /order                           # Get swap quote
POST /execute                         # Execute the swap
GET  /holdings?wallet={address}       # Wallet balances
```

**Rate Limit Strategy:**
- Free tier: 60 req/min across all endpoints
- Price API has separate bucket
- Cron job checks every 1 minute (within limits)
- Handle HTTP 429 with exponential backoff

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard (Next.js)                   │
│  - Enter token mint address                             │
│  - View trading plan (entry, stop-loss, take-profit)    │
│  - Approve/reject plan                                  │
│  - Monitor active trades                                │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL)                   │
│  Tables:                                                │
│  - trading_plans (token, entry, stop_loss, take_profit) │
│  - price_snapshots (for monitoring/history)             │
│  - trades (executed trades log)                         │
│  - wallet_config (encrypted Phantom wallet connection)  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│              Vercel Cron Job (every 1 min)              │
│  /api/cron/monitor-trades                               │
│  - Fetch active trading plans                           │
│  - Check current price via Jupiter /order               │
│  - If stop-loss or take-profit hit → execute swap       │
│  - Log trade result                                     │
└─────────────────────────────────────────────────────────┘
                            │
                      Jupiter API
                  (quotes + execution)
```

### Trading Flow

1. **Create Plan**: User enters token mint → bot fetches current price → shows plan
2. **Configure**: User sets stop-loss % and take-profit %
3. **Approve**: Plan saved to `trading_plans` with status='active'
4. **Monitor**: Cron checks price every minute against active plans
5. **Execute**: When trigger hit, swap via Jupiter, update plan status='completed'
6. **Log**: Record trade in `trades` table with entry/exit prices, P&L

### Wallet Integration

Dedicated trading wallet for automated execution:
- Generate new Solana keypair via dashboard or CLI
- Private key encrypted with AES-256-GCM before storage (uses SUPABASE_SERVICE_ROLE_KEY as encryption key)
- Fund wallet with only SOL you're willing to risk
- Cron job decrypts key server-side to sign transactions

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=     # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=    # Supabase service role key (also used for encryption)
JUPITER_API_KEY=              # Free tier API key from https://portal.jup.ag
CRON_SECRET=                  # Random string to authenticate cron requests
NEXT_PUBLIC_SITE_URL=         # Your site URL for redirects
```

### Cron Job

The cron job at `/api/cron/monitor-trades` runs every minute (Vercel Pro required for per-minute crons, or use external cron service):
- Protected by `CRON_SECRET` in Authorization header
- Uses service role client to bypass RLS
- Checks all active plans against current Jupiter prices
- Executes sell when stop-loss or take-profit is triggered
