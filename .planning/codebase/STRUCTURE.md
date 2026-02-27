# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
cs12-app/
├── src/
│   ├── app/                    # Next.js App Router — pages + API routes
│   │   ├── api/                # 31 API route handlers
│   │   │   ├── activities/     # Activity logging (GET, POST)
│   │   │   ├── chat/           # AI chat stub (disabled)
│   │   │   ├── clients/        # Client overview endpoint
│   │   │   ├── dashboard/      # Dashboard config + metrics
│   │   │   ├── data-tables/    # Flexible data tables CRUD (nested: [id]/rows, columns, periods)
│   │   │   ├── doctors/        # Doctor CRUD + period progress
│   │   │   ├── dsos/           # DSO/client workspace CRUD
│   │   │   ├── metrics/        # Dashboard metric config + performance monitoring
│   │   │   ├── overview-widgets/ # Widget configuration for client overview
│   │   │   ├── progress/       # Aggregated progress data
│   │   │   ├── search/         # Cross-entity search
│   │   │   ├── tasks/          # Task management
│   │   │   ├── team/           # Team member management + invites
│   │   │   ├── templates/      # Data table templates
│   │   │   └── terminology/    # Per-client terminology overrides
│   │   ├── admin/
│   │   │   └── system/         # System health dashboard page
│   │   ├── agent/              # AI agent page (stub/experimental)
│   │   ├── clients/
│   │   │   └── [id]/           # Client detail page (tabbed: Attendees/Overview/Activity/Progress)
│   │   ├── doctors/            # Doctors list page
│   │   ├── login/              # Login/signup page
│   │   ├── settings/           # User/account settings page
│   │   ├── layout.tsx          # Root layout — providers + AppShell
│   │   ├── page.tsx            # Home / dashboard (ClientsOverview)
│   │   └── globals.css         # Global styles
│   ├── components/             # React components by domain
│   │   ├── activities/         # Activity timeline, report dialog
│   │   ├── auth/               # AuthGuard
│   │   ├── clients/            # ClientsOverview, ClientSettingsDialog, ProgressTab, etc.
│   │   ├── dashboard/          # ExecutiveDashboard, OverviewConfigDialog
│   │   ├── data-tables/        # DataGrid, DataTablesView, dialogs for columns/import/export
│   │   ├── doctors/            # Doctors content component
│   │   ├── layout/             # AppShell, NotionSidebar, SearchCommand
│   │   ├── metrics/            # MetricConfigDialog
│   │   ├── navigation/         # DSO switcher, header
│   │   ├── onboarding/         # Onboarding tour, trigger, checklist
│   │   ├── settings/           # Settings components
│   │   ├── tasks/              # Task board
│   │   ├── ui/                 # shadcn/ui primitives (button, card, dialog, input, etc.)
│   │   └── person-detail-panel.tsx  # Shared person detail slide-over
│   ├── contexts/               # React Context providers
│   │   ├── auth-context.tsx    # Auth state, signIn/signUp/signOut
│   │   ├── clients-context.tsx # DSO/client list with refresh
│   │   ├── metric-config-context.tsx # Dashboard metric visibility per client
│   │   └── onboarding-context.tsx    # New-user onboarding tour state
│   ├── lib/                    # Shared utilities and business logic
│   │   ├── auth.ts             # API auth helpers (requireAuth, requireDsoAccess)
│   │   ├── api-monitor.ts      # Performance monitoring wrapper
│   │   ├── csv-utils.ts        # CSV import transformation utilities
│   │   ├── mock-data.ts        # Template definitions for data tables
│   │   ├── pdf-generator.ts    # PDF export utility
│   │   ├── utils.ts            # General utilities (cn class helper, etc.)
│   │   ├── calculations/
│   │   │   ├── risk-level.ts   # Doctor risk level computation
│   │   │   └── metrics.ts      # Dashboard metric calculations
│   │   ├── db/
│   │   │   ├── client.ts       # Supabase client instances (supabase, supabaseAdmin)
│   │   │   └── types.ts        # All TypeScript types for DB entities
│   │   └── metrics/
│   │       └── metric-library.ts  # Metric definitions and defaults
│   └── supabase/               # (Legacy/alternative) Supabase client location
├── supabase/                   # Supabase CLI project
│   ├── config.toml             # Local Supabase config
│   ├── migrations/             # SQL migration files (run in chronological order)
│   └── seed.sql                # (if present) Test data for local dev
├── docs/                       # Architecture and developer documentation
│   ├── DATA_TABLES_ARCHITECTURE.md   # Critical: row data format, column ID keys
│   ├── DATABASE_MIGRATION_GUIDE.md   # When/how to migrate away from Supabase
│   ├── LOCAL_DEVELOPMENT.md          # Local dev setup
│   ├── QUICK_WINS_SETUP.md           # Monitoring setup
│   └── TEAM_MANAGEMENT_BACKEND.md    # Team invite system docs
├── tests/                      # End-to-end tests (Playwright)
├── scripts/                    # Utility scripts
├── migrations/                 # Additional/legacy migration scripts
├── public/                     # Static assets
├── CLAUDE.md                   # Project instructions for Claude
├── package.json
├── tsconfig.json
├── next.config.ts
├── components.json             # shadcn/ui configuration
├── playwright.config.ts
└── vitest.config.ts
```

## Directory Purposes

**`src/app/api/`:**
- Purpose: All backend API endpoints — one `route.ts` per directory = one endpoint
- Pattern: Each route file exports named HTTP handlers (`GET`, `POST`, `PATCH`, `DELETE`)
- Key files: `src/app/api/dsos/route.ts`, `src/app/api/data-tables/route.ts`, `src/app/api/activities/route.ts`
- Nested routes for resource actions: `src/app/api/data-tables/[id]/rows/[rowId]/periods/[periodId]/route.ts`

**`src/app/clients/[id]/`:**
- Purpose: The main working area — per-client tabbed dashboard
- Key file: `src/app/clients/[id]/page.tsx`
- Tabs: Attendees (data tables), Overview (executive dashboard), Activity (timeline), Progress (period tracking)

**`src/components/data-tables/`:**
- Purpose: The core product UI — flexible spreadsheet with 16 column types
- Key file: `src/components/data-tables/data-grid.tsx` (the main grid component)
- Other: `data-tables-view.tsx` (container), `import-csv-dialog.tsx`, `period-data-dialog.tsx`

**`src/components/ui/`:**
- Purpose: shadcn/ui component library — pre-built, styled primitives
- These are generated/owned files from shadcn/ui. Modify only if customizing a primitive.
- Contains: button, card, dialog, input, label, select, sheet, table, tabs, etc.

**`src/lib/db/types.ts`:**
- Purpose: Single source of truth for all TypeScript types
- Contains: Entity interfaces (`Client`, `Doctor`, `Activity`, `DataTable`, `DataRow`, `DataColumn`), enums (`RiskLevel`, `UserRole`, `ColumnType`), API response types, `DEFAULT_TERMINOLOGY`
- Used by: All API routes and most components

**`src/lib/auth.ts`:**
- Purpose: Auth middleware for API routes
- The four helpers used in every API route: `requireAuth`, `requireAuthWithFallback`, `requireDsoAccess`, `requireDsoAccessWithFallback`

**`supabase/migrations/`:**
- Purpose: Ordered SQL migration files applied by Supabase CLI
- Naming: `YYYYMMDD[HHMMSS]_description.sql`
- Run locally: `supabase db reset` (drops + replays all migrations)
- Push to prod: `supabase db push`

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout — wraps entire app in providers
- `src/app/page.tsx`: Home page (renders `ClientsOverview`)
- `src/app/login/page.tsx`: Authentication page

**Configuration:**
- `src/lib/db/client.ts`: Supabase client configuration (env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- `next.config.ts`: Next.js configuration (minimal)
- `supabase/config.toml`: Local Supabase instance config
- `.env.local`: Environment variables (not committed; see `.env.local.example`)

**Core Logic:**
- `src/lib/db/types.ts`: All TypeScript type definitions
- `src/lib/auth.ts`: Auth helpers used in every API route
- `src/lib/calculations/risk-level.ts`: Risk level scoring algorithm
- `src/lib/mock-data.ts`: Data table template definitions

**Testing:**
- `tests/`: Playwright end-to-end tests
- `src/app/page.test.tsx`: Vitest unit test for home page
- `vitest.config.ts`: Vitest configuration
- `playwright.config.ts`: Playwright E2E configuration

## Naming Conventions

**Files:**
- Pages: `page.tsx` (required by Next.js App Router)
- API routes: `route.ts` (required by Next.js App Router)
- Components: `kebab-case.tsx` — e.g., `data-grid.tsx`, `executive-dashboard.tsx`
- Contexts: `kebab-case-context.tsx` — e.g., `auth-context.tsx`
- Utilities: `kebab-case.ts` — e.g., `api-monitor.ts`, `risk-level.ts`

**Directories:**
- Feature components: `kebab-case/` matching domain — e.g., `data-tables/`, `clients/`
- API routes: `kebab-case/` matching resource name — e.g., `data-tables/`, `overview-widgets/`
- Dynamic segments: `[paramName]/` — e.g., `[id]/`, `[rowId]/`

**TypeScript:**
- Interfaces: PascalCase — e.g., `DataTable`, `AuthResult`, `ColumnConfig`
- Types/Unions: PascalCase — e.g., `RiskLevel`, `ColumnType`, `UserRole`
- Functions: camelCase — e.g., `calculateRiskLevel`, `requireDsoAccess`
- Constants: UPPER_SNAKE_CASE for true constants — e.g., `DEFAULT_TERMINOLOGY`
- React components: PascalCase — e.g., `ExecutiveDashboard`, `NotionSidebar`

## Where to Add New Code

**New API endpoint:**
- Create directory: `src/app/api/[resource-name]/`
- Create file: `src/app/api/[resource-name]/route.ts`
- Import auth helpers from `src/lib/auth.ts`
- Import DB client from `src/lib/db/client.ts` (use `supabaseAdmin` for data access)
- Follow pattern: `requireDsoAccessWithFallback` → Supabase query → `NextResponse.json()`
- Wrap with `withMonitoring()` from `src/lib/api-monitor.ts` for performance tracking

**New page:**
- Create directory: `src/app/[page-name]/`
- Create file: `src/app/[page-name]/page.tsx`
- Add `'use client';` directive if using hooks or browser APIs
- Use `useClients()` from `src/contexts/clients-context` if needing client list

**New feature component:**
- Add to `src/components/[domain]/[component-name].tsx`
- Use existing `src/components/ui/` primitives (button, card, dialog, etc.)
- Import types from `src/lib/db/types.ts`

**New entity type:**
- Add interface/type to `src/lib/db/types.ts`
- Create migration: `supabase migration new [description]`

**New utility/helper:**
- Shared utilities: `src/lib/utils.ts` or a new `src/lib/[name].ts`
- Business logic / calculations: `src/lib/calculations/[name].ts`
- Metric definitions: `src/lib/metrics/metric-library.ts`

**New shadcn/ui component:**
- Run `npx shadcn@latest add [component]`
- Output goes to `src/components/ui/` automatically

## Special Directories

**`.planning/`:**
- Purpose: GSD planning artifacts (phases, codebase analysis docs)
- Generated: No — manually created and maintained
- Committed: Yes

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (by `npm run dev` / `npm run build`)
- Committed: No (in `.gitignore`)

**`supabase/.branches/` and `supabase/.temp/`:**
- Purpose: Supabase CLI working files
- Generated: Yes
- Committed: No

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No

**`docs/`:**
- Purpose: Developer reference documentation
- Key file: `docs/DATA_TABLES_ARCHITECTURE.md` — **must read before working with data tables**
- Generated: No — hand-written
- Committed: Yes

---

*Structure analysis: 2026-02-26*
