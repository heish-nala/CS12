# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** Next.js App Router full-stack monolith with Supabase backend

**Key Characteristics:**
- All frontend and backend code coexists in one repo — pages in `src/app/`, API routes in `src/app/api/`
- No separate service layer — API routes call Supabase directly via `supabaseAdmin`
- Multi-tenant: every resource is scoped to a DSO (client workspace) via `user_dso_access` table
- Business logic computed at API layer (risk levels, period aggregations) — not stored in DB
- React Context used for global client state (auth, clients list, metric config)

## Layers

**Pages (UI Layer):**
- Purpose: Render views, handle local component state, call internal API routes
- Location: `src/app/` (non-API directories: `clients/[id]`, `doctors/`, `settings/`, `login/`, `admin/system/`, `agent/`)
- Contains: Next.js page components, client-side routing logic
- Depends on: Components, Contexts
- Used by: Browser

**API Routes:**
- Purpose: Data access, auth enforcement, business logic computation
- Location: `src/app/api/` (31 endpoints)
- Contains: `GET`/`POST`/`PATCH`/`DELETE` handlers using Next.js Route Handlers
- Depends on: `src/lib/auth.ts`, `src/lib/db/client.ts`, `src/lib/calculations/`
- Used by: Pages (via `fetch()`), external callers

**Components:**
- Purpose: Reusable UI — feature components and shared UI primitives
- Location: `src/components/`
- Contains: Feature components grouped by domain, shadcn/ui primitives in `src/components/ui/`
- Depends on: Contexts, `src/lib/utils.ts`
- Used by: Pages

**Contexts:**
- Purpose: Global client-side state shared across the component tree
- Location: `src/contexts/`
- Contains: `AuthContext`, `ClientsContext`, `OnboardingContext`, `MetricConfigContext`
- Depends on: `src/lib/db/client.ts` (supabase browser client), API routes
- Used by: Components, Pages

**Library (Shared Logic):**
- Purpose: Utilities, type definitions, DB client, business logic calculations
- Location: `src/lib/`
- Contains: Auth helpers (`auth.ts`), DB client + types (`db/`), risk calculations (`calculations/`), metric library (`metrics/`), API monitor, CSV utils, PDF generator
- Depends on: Supabase SDK, external packages
- Used by: API routes, components

## Data Flow

**Authenticated Page Load:**
1. `AuthGuard` (in `src/app/layout.tsx`) checks `AuthContext` — redirects to `/login` if no session
2. `AppShell` renders `NotionSidebar` + main content area
3. `ClientsProvider` fetches `/api/dsos` to populate sidebar client list
4. Page component renders; feature components call their specific API routes via `fetch()`
5. API routes validate auth via `requireAuth()` or `requireDsoAccess()`, then query Supabase

**Create/Update Flow (e.g., adding a row to a data table):**
1. User action in component (e.g., `data-grid.tsx`)
2. Component calls `fetch('/api/data-tables/[id]/rows', { method: 'POST', body: ... })`
3. API route calls `requireDsoAccessWithFallback()` — checks session cookie, falls back to `user_id` query param
4. `supabaseAdmin` (service role key) executes INSERT against Supabase PostgreSQL
5. Response returned as JSON; component updates local state

**Risk Level Computation:**
1. `GET /api/doctors` fetches doctors with joined `period_progress` and `activities`
2. For each doctor, `calculateRiskLevel()` in `src/lib/calculations/risk-level.ts` computes risk from days-since-activity and engagement score
3. Enriched doctor objects returned — `risk_level`, `days_since_activity`, `total_cases`, `total_courses` are computed fields, not stored in DB

**State Management:**
- Global: React Context for auth state, clients list, onboarding state, metric config
- Local: `useState` within feature components for form state, loading states, UI state
- No Redux or Zustand — Context is used throughout
- Server state not cached on client — every page load re-fetches from API

## Key Abstractions

**DSO (Client Workspace):**
- Purpose: The top-level multi-tenant boundary — a Dental Service Organization = a "client" in the UI
- Table: `dsos` (the UI calls them "clients" but the DB table is still `dsos`)
- Note: `DSO` type is aliased to `Client` in `src/lib/db/types.ts` for backwards compatibility
- Access controlled via `user_dso_access` join table (roles: `admin`, `manager`, `viewer`)
- Examples: `src/app/api/dsos/route.ts`, `src/contexts/clients-context.tsx`

**Data Tables System:**
- Purpose: Flexible, user-defined spreadsheet-like tables per client workspace (Notion-style)
- Tables: `data_tables`, `data_columns`, `data_rows`, `period_data`
- Pattern: Row data stored as `Record<string, any>` keyed by **column UUID** (not column name) — see `docs/DATA_TABLES_ARCHITECTURE.md`
- Supports 16 column types including `status`, `select`, `multi_select`, `currency`, `person`, `relationship`
- Time tracking: tables can have `time_tracking` config for weekly/monthly/quarterly metric collection
- Examples: `src/components/data-tables/data-grid.tsx`, `src/app/api/data-tables/[id]/route.ts`

**Auth Helpers:**
- Purpose: Consistent auth enforcement across all API routes
- Location: `src/lib/auth.ts`
- Four helper functions:
  - `requireAuth(request)` — session cookie only
  - `requireAuthWithFallback(request)` — session cookie OR `?user_id=` query param
  - `requireDsoAccess(request, dsoId)` — session cookie + DSO membership check
  - `requireDsoAccessWithFallback(request, dsoId)` — session OR `user_id` param + DSO membership check
- All return discriminated union: `{ user } | { response: NextResponse }` — caller checks `'response' in result`

**Risk Level:**
- Purpose: Compute engagement health score for doctors
- Location: `src/lib/calculations/risk-level.ts`
- Levels: `low` | `medium` | `high` | `critical`
- Formula: days-since-last-activity + engagement score (cases/courses vs expected rate)
- Critical threshold: 14+ days without activity

**Terminology System:**
- Purpose: Allow each client to rename domain concepts (e.g., "doctor" → "attendee", "case" → "scan")
- Table: `client_terminology` (per-DSO overrides)
- Defaults in: `src/lib/db/types.ts` `DEFAULT_TERMINOLOGY` constant
- API: `GET/POST /api/terminology`

## Entry Points

**Application Root:**
- Location: `src/app/layout.tsx`
- Triggers: Every page load
- Responsibilities: Wraps all pages in `AuthProvider` → `ClientsProvider` → `OnboardingProvider` → `AuthGuard` → `AppShell`. Mounts global toast (`Toaster`) and onboarding components.

**Dashboard (Home):**
- Location: `src/app/page.tsx`
- Triggers: User navigates to `/`
- Responsibilities: Renders `ClientsOverview` component — the main client list view

**Client Detail:**
- Location: `src/app/clients/[id]/page.tsx`
- Triggers: User clicks a client in the sidebar
- Responsibilities: Fetches client from context, renders tabbed view: Attendees (DataTablesView), Overview (ExecutiveDashboard), Activity (ActivityTimeline), Progress (ProgressTab). Wraps children in `MetricConfigProvider`.

**API Routes:**
- Location: `src/app/api/` (one `route.ts` per directory)
- Triggers: `fetch()` calls from components or external callers
- Responsibilities: Auth check → Supabase query → JSON response

**Auth Guard:**
- Location: `src/components/auth/auth-guard.tsx`
- Triggers: Every render (watches `useAuth()`)
- Responsibilities: Redirects unauthenticated users to `/login`; redirects authenticated users away from `/login`

## Error Handling

**Strategy:** Try/catch in API routes with generic 500 responses; console.error logging; no centralized error tracking

**Patterns:**
- API routes: `try { ... } catch (error) { console.error(...); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }`
- Schema fallback: Several API routes detect missing DB columns (PostgreSQL error code `42703`) and retry without the new column — allows gradual migration
- Auth errors return 401/403 before reaching business logic
- Client-side: Components handle loading states with skeleton UIs; errors shown in toast notifications via `sonner`

## Cross-Cutting Concerns

**Logging:** `console.error` in API routes; `console.log` for dev; `withMonitoring()` wrapper in `src/lib/api-monitor.ts` tracks response times (threshold: 200ms, last 100 metrics in memory)

**Validation:** Inline in API routes — check required fields, return 400 with error message. No Zod or validation library.

**Authentication:** Supabase Auth (email/password + Google OAuth). Two clients:
- `supabase` (browser client, `createBrowserClient`) — used in contexts and non-admin reads
- `supabaseAdmin` (service role, `createClient`) — used in all API routes for unrestricted DB access
- All DB tables have Row Level Security (RLS) enabled but API routes bypass RLS via service role key

**Multi-tenancy:** Enforced at API layer via `user_dso_access` table checks. Every data-modifying endpoint calls `requireDsoAccess()` or `requireDsoAccessWithFallback()` before any DB writes.

---

*Architecture analysis: 2026-02-26*
