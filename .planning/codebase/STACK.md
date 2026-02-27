# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- TypeScript 5.x - All application code, API routes, lib utilities, and components
- SQL - Supabase migrations in `supabase/migrations/`

**Secondary:**
- Shell - Husky git hook at `.husky/pre-push`

## Runtime

**Environment:**
- Node.js (no `.nvmrc` or `.node-version` present; `@types/node` pinned to `^20`)
- Target: ES2017 per `tsconfig.json`

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.0.7 — Full-stack React framework (App Router). Config at `next.config.ts` (minimal, no custom options set).
- React 19.2.0 — UI rendering
- Supabase SSR 0.8.0 — Server-side rendering integration with cookie-based auth

**Testing:**
- Vitest 4.0.14 — Unit tests. Config at `vitest.config.ts`. Uses jsdom environment.
- Playwright 1.57.0 — E2E and UX tests. Config at `playwright.config.ts`. Runs against `http://localhost:3000` with Chromium only.
- @testing-library/react 16.3.0 — React component testing utilities
- @axe-core/playwright 4.11.0 — Accessibility testing in Playwright

**Build/Dev:**
- Tailwind CSS 4 — Utility-first CSS. Config via `postcss.config.mjs`, globals in `src/app/globals.css`.
- @tailwindcss/postcss 4 — PostCSS integration for Tailwind 4
- tsx 4.20.6 — TypeScript execution for scripts (`scripts/api-health-check.ts`, `scripts/qa-agent.ts`)
- Husky — Pre-push git hook that runs `scripts/api-health-check.ts`

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.86.0 — Primary database + auth client. Client init at `src/lib/db/client.ts`.
- `@supabase/ssr` 0.8.0 — Cookie-sync for SSR auth. Used in `src/lib/auth.ts` and `src/lib/db/client.ts`.
- `next` 16.0.7 — Framework; all routing, API, SSR

**UI Components:**
- `shadcn/ui` — Component library installed as source files in `src/components/ui/`. Style: "new-york". Config at `components.json`. Icon library: lucide.
- `@radix-ui/*` — Primitive components backing shadcn (avatar, checkbox, dialog, dropdown-menu, label, popover, radio-group, scroll-area, select, slot, switch, tabs, toggle-group)
- `lucide-react` 0.555.0 — Icon set
- `@tanstack/react-table` 8.21.3 — Headless table engine for data tables
- `@tanstack/react-virtual` 3.13.18 — Virtual scrolling for large datasets
- `class-variance-authority` 0.7.1 — Component variant management (shadcn pattern)
- `clsx` 2.1.1 + `tailwind-merge` 3.4.0 — Conditional class utilities
- `cmdk` 1.1.1 — Command palette component
- `sonner` 2.0.7 — Toast notifications (used as `<Toaster>` in `src/app/layout.tsx`)
- `next-themes` 0.4.6 — Dark/light theme support
- `react-joyride` 3.0.0-7 — In-app onboarding tours (`src/components/onboarding/`)
- `canvas-confetti` 1.9.4 — Celebration animations

**Data Utilities:**
- `papaparse` 5.5.3 — CSV parsing. Used in `src/lib/csv-utils.ts`.
- `date-fns` 4.1.0 — Date manipulation
- `zod` 4.1.13 — Schema validation
- `use-debounce` 10.1.0 — Debounced input hooks

**PDF Generation:**
- `jspdf` 3.0.4 — PDF generation. Used in `src/lib/pdf-generator.ts`.
- `jspdf-autotable` 5.0.2 — Table rendering in PDFs

**AI (partially disabled):**
- `ai` 5.0.102 — Vercel AI SDK core
- `@ai-sdk/openai` 2.0.73 — OpenAI provider
- `@ai-sdk/react` 2.0.102 — React hooks (`useChat`). Used in `src/app/agent/page.tsx`.

## Configuration

**Environment:**
- Required vars documented in `.env.local.example`:
  - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public anon key
  - `SUPABASE_SERVICE_ROLE_KEY` — Server-side admin key
  - `OPENAI_API_KEY` — OpenAI (for AI chat, currently disabled)
- `.env.local` present (do not read)
- `.env.local.supabase` present (do not read)
- Fallback placeholder values in `src/lib/db/client.ts` allow app to boot without env vars (mock data mode)

**TypeScript:**
- Strict mode on
- Path alias: `@/*` → `./src/*`
- Module resolution: `bundler`

**Build:**
- `next.config.ts` — minimal, no custom configuration
- `postcss.config.mjs` — PostCSS with Tailwind

## Platform Requirements

**Development:**
- Node.js 20+
- Supabase CLI (for local DB: `supabase start`)
- Local Supabase runs on ports 54321 (API), 54322 (DB), 54323 (Studio)
- Local Studio at `http://127.0.0.1:54323`

**Production:**
- GitHub remote: `https://github.com/heish-nala/CS12.git` (branch: `main`)
- Supabase cloud project ref: `vekxzuupejmitvwwokrf`
- PostgreSQL 17.6.1 (Supabase managed)
- No deployment platform detected in config (no Vercel/Railway config files present)

---

*Stack analysis: 2026-02-26*
