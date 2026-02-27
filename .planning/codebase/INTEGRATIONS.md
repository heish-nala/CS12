# External Integrations

**Analysis Date:** 2026-02-26

## APIs & External Services

**AI / LLM:**
- OpenAI — AI chat assistant (currently disabled in production)
  - SDK/Client: `@ai-sdk/openai`, `ai` (Vercel AI SDK)
  - Auth: `OPENAI_API_KEY` env var
  - Route: `src/app/api/chat/route.ts` — handler returns 503; implementation commented out
  - UI: `src/app/agent/page.tsx` uses `useChat` from `@ai-sdk/react` targeting `/api/chat`
  - Scripts: `scripts/qa-agent.ts` uses OpenAI via `@ai-sdk/openai` for automated QA

## Data Storage

**Databases:**
- Supabase (PostgreSQL 17.6.1)
  - Production connection: env var `NEXT_PUBLIC_SUPABASE_URL` (project ref `vekxzuupejmitvwwokrf`)
  - Local development: `http://localhost:54321` (Supabase CLI Docker)
  - Client (server-side admin): `supabaseAdmin` in `src/lib/db/client.ts` — uses `SUPABASE_SERVICE_ROLE_KEY`, no session persistence
  - Client (browser): `supabase` (browser client) in `src/lib/db/client.ts` — uses `createBrowserClient` from `@supabase/ssr` for cookie sync
  - Client (SSR/API routes): `createServerClient` from `@supabase/ssr` — instantiated per-request in `src/lib/auth.ts`
  - All tables have Row Level Security (RLS) enabled
  - Migrations: `supabase/migrations/` (10 migration files, initial schema Dec 2024 through Jan 2026)

**File Storage:**
- Not configured. Supabase Storage is enabled in `supabase/config.toml` (50MiB limit) but no storage API usage detected in application code.

**Caching:**
- None. API metrics use an in-memory ring buffer (last 100 entries) in `src/lib/api-monitor.ts`.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in to Supabase project)
  - Implementation: Cookie-based sessions via `@supabase/ssr`
  - Auth context: `src/contexts/auth-context.tsx` — wraps entire app via `src/app/layout.tsx`
  - Auth guard: `src/components/auth/auth-guard.tsx` — redirects unauthenticated users

**Auth Methods:**
- Email + password: `supabase.auth.signInWithPassword()` and `supabase.auth.signUp()`
- Google OAuth: `supabase.auth.signInWithOAuth({ provider: 'google' })` — configured in `supabase/config.toml` with `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars
- JWT expiry: 3600 seconds (1 hour), refresh token rotation enabled

**Authorization Model:**
- Role-based per DSO (workspace): roles are `admin`, `manager`, `viewer`
- Access controlled via `user_dso_access` database table
- Server-side enforcement via `requireAuth()`, `requireDsoAccess()` helpers in `src/lib/auth.ts`
- Write access (create/update/delete) requires `admin` or `manager` role

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, or similar detected)

**Performance Monitoring:**
- Custom in-process API monitor: `src/lib/api-monitor.ts`
  - `withMonitoring()` wrapper tracks response times per endpoint
  - Slow query threshold: 200ms — logs warning to console
  - Metrics endpoint: `src/app/api/metrics/performance/route.ts`
  - Dashboard: `src/app/admin/system/` — visual dashboard for API health
  - Data is in-memory only; resets on server restart

**Logs:**
- `console.log` / `console.warn` / `console.error` throughout API routes and lib
- No structured logging or external log aggregation

## CI/CD & Deployment

**Hosting:**
- Production deployment platform: Not configured (no `vercel.json`, `railway.toml`, or similar in project root)
- GitHub repository: `https://github.com/heish-nala/CS12.git` (branch: `main`)

**CI Pipeline:**
- None detected (no `.github/workflows/` directory found)

**Git Hooks:**
- Pre-push hook at `.husky/pre-push`: runs `scripts/api-health-check.ts` if dev server is running on port 3000; aborts push on failure

**Database Deployment:**
- `supabase db push` — pushes local migrations to production Supabase project
- `supabase db reset` — resets local DB and reruns all migrations

## Email

**Transactional Email:**
- Supabase handles auth emails (signup confirmation, password reset) via its built-in email service
- Local development: Inbucket at port 54324 (SMTP: 54325, POP3: 54326) captures outgoing auth emails

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project API URL (public, exposed to browser)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key (public, exposed to browser)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server only, admin access, bypasses RLS)
- `OPENAI_API_KEY` — OpenAI API key (server only, for AI chat — currently disabled)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (Supabase auth config)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret (Supabase auth config)

**Secrets location:**
- `.env.local` — local development secrets (gitignored)
- `.env.local.supabase` — alternative local Supabase config (gitignored)
- Production secrets managed in Supabase dashboard and deployment platform environment

---

*Integration audit: 2026-02-26*
