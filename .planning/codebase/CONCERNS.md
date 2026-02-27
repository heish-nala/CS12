# Codebase Concerns

**Analysis Date:** 2026-02-26

---

## Security Considerations

**`user_id` Query Parameter as Auth Bypass:**
- Risk: Multiple API routes fall back to an unverified `user_id` query parameter when session auth fails. Any caller who knows a valid user UUID can impersonate that user.
- Files: `src/lib/auth.ts` (`requireAuthWithFallback`, `requireDsoAccessWithFallback`), `src/app/api/dsos/route.ts`, `src/app/api/clients/overview/route.ts`, `src/app/api/team/route.ts`, `src/app/api/search/route.ts`, `src/app/api/data-tables/route.ts`
- Current mitigation: The `user_id` is still cross-checked against `user_dso_access`, so a caller must know a valid UUID *and* that user must already have access to the requested resource.
- Recommendations: Remove the `user_id` param fallback entirely. Session cookies are the correct auth path in Next.js App Router. The fallback pattern was added for the frontend (which passes `user.id` via URL), but the frontend should rely on cookies instead.

**`user_id` Body Payload as Auth Bypass (write operations):**
- Risk: POST/PUT routes in `src/app/api/data-tables/route.ts` and `src/app/api/data-tables/[id]/rows/route.ts` contain a secondary manual access check using `user_id` from the request body. This bypasses the central `requireDsoAccessWithFallback` helper and introduces duplicate, less-audited auth logic.
- Files: `src/app/api/data-tables/route.ts` lines 129–145, `src/app/api/data-tables/[id]/rows/route.ts` lines 77–93
- Recommendations: Consolidate on `requireDsoAccessWithFallback(request, clientId, true, body)` which already handles the body fallback. Remove the inline re-implementations.

**Performance Metrics Endpoint Unauthenticated:**
- Risk: `GET /api/metrics/performance` returns internal API timing data with no authentication at all. This exposes endpoint names and response time patterns to unauthenticated callers.
- Files: `src/app/api/metrics/performance/route.ts` (no auth check — confirmed by code inspection), `src/app/admin/system/page.tsx`
- Current mitigation: The code comment on line 23 says "In production, you might want to restrict access."
- Recommendations: Add `requireAuth` to this route. The admin page already requires a logged-in user via `AuthGuard`, but the raw API is unprotected.

**`invited_by` Body Param Accepted Without Session (invite flow):**
- Risk: `POST /api/team/invite` accepts `invited_by` as a fallback when session auth fails and uses it to look up the caller via `supabaseAdmin.auth.admin.getUserById`. If the user UUID is guessable/leaked, a caller could impersonate an admin inviter.
- Files: `src/app/api/team/invite/route.ts` lines 9–26
- Recommendations: Require session auth for all invite creation. This is a privileged admin action and should not tolerate auth fallbacks.

**`supabaseAdmin` Used Where Anon Client Should Be Sufficient (doctors write):**
- Risk: `POST /api/doctors` uses `supabase` (anon browser client) for the insert, which means RLS applies. This is correct. However, `GET /api/doctors` also uses `supabase` (anon client) — RLS will silently return empty results if the session token is missing or expired, rather than returning an error. This creates confusing silent failures.
- Files: `src/app/api/doctors/route.ts` — uses `import { supabase }` (browser client), unlike all other API routes which use `supabaseAdmin`.
- Impact: If the anon key's session is not valid server-side, the GET returns `{ doctors: [], total: 0 }` with no error. This is inconsistent with every other API route.
- Recommendations: Switch `src/app/api/doctors/route.ts` to use `supabaseAdmin` consistently with all other API routes.

**`auth.admin.listUsers()` Fetches All Users:**
- Risk: `src/app/api/team/invite/route.ts` line 82 calls `supabaseAdmin.auth.admin.listUsers()` without pagination to check if an email already exists. This fetches the entire user list into memory on every invite.
- Files: `src/app/api/team/invite/route.ts`
- Impact: Will degrade as user count grows. Also exposes all user records to the in-process invite check logic.
- Recommendations: Use `supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 })` with a filter, or better, query a `user_profiles` table (see Tech Debt below) by email.

---

## Tech Debt

**No `user_profiles` Table — Auth Data Missing in DB:**
- Issue: The app has no database table for user profile information (name, email). When displaying team members, the code falls back to `supabaseAdmin.auth.admin.getUserById()` in a loop, making one Auth API call per team member.
- Files: `src/app/api/team/route.ts` lines 103–149, `src/app/api/team/invite/route.ts` lines 306–317
- Impact: Team page makes N sequential Auth API calls (one per member). Will cause timeouts or rate limits as team size grows.
- Fix approach: Add a `user_profiles` table with `id`, `email`, `name`. Populate on first login via a Supabase Edge Function or the `accept-invite` flow. Query this table instead of `auth.admin.getUserById`.

**Team Member Addition Not Implemented (POST /api/team returns 501):**
- Issue: `POST /api/team` returns HTTP 501 with a TODO comment. The settings UI likely surfaces a broken "Add Team Member" flow.
- Files: `src/app/api/team/route.ts` lines 197–206
- Impact: Any UI calling this endpoint silently fails.
- Fix approach: Either remove the POST handler and hide the UI, or implement it using the same pattern as `POST /api/team/invite`.

**AI Chat Feature Disabled but UI Remains Active:**
- Issue: `src/app/api/chat/route.ts` returns HTTP 503 permanently (all logic commented out). The `/agent` page (`src/app/agent/page.tsx`) still renders a full chat UI using `@ai-sdk/react` that sends messages to this broken endpoint.
- Files: `src/app/api/chat/route.ts`, `src/app/agent/page.tsx`
- Impact: The `/agent` route is a dead end — users can type messages but receive only "AI chat is currently disabled" errors. The `@ai-sdk/openai` dependency is installed and paid for but unused.
- Fix approach: Hide the agent link in navigation until the feature is implemented, or add a placeholder "Coming Soon" state in the UI.

**`archived` Column Missing Migration Guard:**
- Issue: `src/app/api/dsos/route.ts` has a runtime check for PostgreSQL error code `42703` (column does not exist) and falls back to queries without the `archived` filter. This means the app silently shows all clients as active if the migration hasn't run.
- Files: `src/app/api/dsos/route.ts` lines 51–61, `supabase/migrations/20251209_add_archived_to_dsos.sql`
- Impact: If production DB is behind on migrations, archived clients appear as active clients. Data integrity risk.
- Fix approach: Remove the runtime fallback. Ensure the migration is applied before deploy. Use the migration file as the single source of truth.

**`activities.client_id` Column Missing Migration Guard:**
- Issue: `src/app/api/activities/route.ts` checks for `client_id` column missing at runtime and retries without it. Same pattern as above.
- Files: `src/app/api/activities/route.ts` lines 71–83 and 185–195, `supabase/migrations/20260128000000_fix_activities_client_scope.sql`
- Fix approach: Same as above — remove runtime fallback once migration is confirmed applied.

**`mock-data.ts` Is a Dead File:**
- Issue: `src/lib/mock-data.ts` exports empty arrays and stub functions that return nothing. It imports all DB types but provides no data. It exists from an earlier mock-data phase and is still imported in `src/app/api/data-tables/route.ts` (for `mockDataTemplates`).
- Files: `src/lib/mock-data.ts`, `src/app/api/data-tables/route.ts` line 3
- Impact: Minor — the only used export is `mockDataTemplates`. Everything else is dead code that inflates the bundle.
- Fix approach: Extract `mockDataTemplates` into `src/lib/table-templates.ts` and delete `mock-data.ts`.

**Hardcoded 12-Period Program Assumption:**
- Issue: The 12-month program length is hardcoded in multiple places. Course progress is calculated as `(maxPeriod / 12) * 100` in three separate files.
- Files: `src/app/api/clients/overview/route.ts` line 121, `src/app/api/doctors/route.ts` line 68, `src/app/api/dashboard/metrics/route.ts` (implied via the `12` denominator)
- Impact: If a client has a different program length, all progress percentages will be wrong.
- Fix approach: Add `program_length_months` to the `dsos` table and use that value in calculations.

---

## Performance Bottlenecks

**`/api/clients/overview` Fetches All Nested Data:**
- Problem: This route fetches all DSOs with full nested `doctors(*, period_progress(*), activities(*))` in a single query. With 10 clients, 50 doctors each, and 12 periods + all activities per doctor, this is thousands of records.
- Files: `src/app/api/clients/overview/route.ts` lines 43–53
- Cause: The full nested select is used to calculate aggregate metrics server-side.
- Improvement path: Precompute aggregates. Either add computed columns to the DB via a view or move aggregation to a Supabase RPC function. Alternatively, fetch only summary data (doctor count, last activity date) for the overview card.

**`/api/dashboard/metrics` Also Fetches All Nested Data:**
- Problem: Same pattern as above — fetches `doctors(*, period_progress(*), activities(*))` for all accessible DSOs to compute dashboard metrics.
- Files: `src/app/api/dashboard/metrics/route.ts` lines 61–74
- Improvement path: Same as above — a Supabase database view or RPC function would be far more efficient.

**Team Page Makes N Sequential Auth API Calls:**
- Problem: `GET /api/team` fetches one team member at a time via `supabaseAdmin.auth.admin.getUserById` in a sequential `for` loop.
- Files: `src/app/api/team/route.ts` lines 106–149
- Cause: No `user_profiles` table (see Tech Debt above).
- Improvement path: Add `user_profiles` table and batch-query it with `WHERE id IN (...)`.

**`data_rows.data` GIN Index on All JSONB — No Targeted Indexes:**
- Problem: The GIN index on `data_rows.data` indexes the entire JSONB blob. Searches that filter by specific column values (via the data grid) will use this large index but may still be slow for equality lookups on individual fields.
- Files: `supabase/migrations/20241206000000_initial_schema.sql` line 432
- Improvement path: Add expression indexes for the most commonly searched column IDs once usage patterns are known. For now, monitor query plans.

---

## Fragile Areas

**`data-grid.tsx` — 1,342 Lines, Multiple Responsibilities:**
- Files: `src/components/data-tables/data-grid.tsx`
- Why fragile: This single file handles rendering, cell editing, inline sorting, column resizing, phone formatting, bulk selection, row deletion, and the virtualized scroll. Any change to one concern risks breaking the others.
- Safe modification: Make targeted changes to specific render sections only. Avoid touching the `useMemo` and `useCallback` chains at the top of the component unless the full rendering path is understood.
- Test coverage: No unit tests cover this component. Behavior is only verified via E2E tests (`tests/ux.spec.ts`).

**`accept-invite` Grants Access to ALL Inviter's DSOs:**
- Files: `src/app/api/team/accept-invite/route.ts` lines 66–100, `src/app/api/team/invite/route.ts` lines 89–150
- Why fragile: When a user accepts an invite (or is directly added), they are granted access to **all** DSOs the inviter has access to — not just the specific DSO in the invite. This is undocumented behavior that could lead to unintended access grants.
- Safe modification: Treat this as intentional (bulk-workspace onboarding) only if confirmed with stakeholders. Otherwise, scope invite acceptance to `invite.dso_id` only.
- Test coverage: No test covers this multi-DSO expansion behavior.

**`supabase/migrations/` — No Down Migrations:**
- Files: `supabase/migrations/` (all 10 files)
- Why fragile: None of the migration files include rollback SQL. If a bad migration reaches production, rolling back requires manual intervention.
- Safe modification: Always test with `supabase db reset` locally before pushing. The `CLAUDE.md` documents this requirement, but it is not enforced.

**`AuthGuard` Client-Side Only — No Middleware:**
- Files: `src/components/auth/auth-guard.tsx`
- Why fragile: Authentication is enforced via a React `useEffect` redirect after the page renders. There is no Next.js middleware (`middleware.ts`) at the edge. Unauthenticated users momentarily see the protected page content before being redirected.
- Safe modification: The current approach works but is not production-grade. Adding `middleware.ts` with Supabase session checks would harden this. Do not rely on `AuthGuard` alone for sensitive data visibility.

**In-Memory API Metrics Buffer Lost on Restart:**
- Files: `src/lib/api-monitor.ts`
- Why fragile: The `metricsBuffer` array is module-level state. It is lost on every server restart or Vercel function cold start. The `/admin/system` dashboard will show empty metrics after any deployment.
- Safe modification: This is acceptable for dev-time monitoring. Do not use it for production alerting or SLA tracking.

---

## Missing Critical Features

**No Rate Limiting on Any API Route:**
- Problem: There is no rate limiting on invite sending, activity creation, search, or any other endpoint.
- Blocks: Any public-facing form or endpoint is vulnerable to abuse. The invite endpoint already has a Supabase internal rate limit but the app does not surface clear errors.
- Priority: Medium — mitigate by adding Vercel Edge Rate Limiting or a simple in-memory token bucket on the most sensitive routes.

**No Input Sanitization on Search:**
- Problem: `GET /api/search?q=` passes the query directly into `ilike.%${query}%` Supabase filters. Special ILIKE metacharacters (`%`, `_`) are not escaped.
- Files: `src/app/api/search/route.ts` lines 49, 67
- Risk: A user can craft a search query with `%` characters to match all records, potentially causing slow full-table scans rather than indexed lookups.
- Priority: Low — data visibility is still scoped by `user_dso_access`, so this is a performance risk not a data leak.

---

## Test Coverage Gaps

**Entire API Layer Untested:**
- What's not tested: All 31 API routes in `src/app/api/` have no unit tests. The only test file is `src/app/page.test.tsx` which tests that the homepage renders two headings.
- Files: All files under `src/app/api/`
- Risk: Auth fallback logic, data merge behavior in row updates, and the multi-DSO invite expansion could all break silently.
- Priority: High — auth and access control logic in `src/lib/auth.ts` and invite flows are the most critical gaps.

**Business Logic Calculations Untested:**
- What's not tested: `src/lib/calculations/risk-level.ts` has no tests. The `calculateRiskLevel` function determines which doctors are shown as at-risk and drives dashboard counts.
- Files: `src/lib/calculations/risk-level.ts`, `src/lib/calculations/metrics.ts`
- Risk: A silent regression could flip risk levels for all doctors.
- Priority: High — these are pure functions with no external deps and would be straightforward to test.

**E2E Tests Require Real Auth:**
- What's not tested: `tests/ux.spec.ts` and `tests/example.spec.ts` are Playwright tests. They require a running app and likely a seeded database. There is no CI/CD pipeline configured in this repo (no `.github/workflows/`).
- Files: `tests/`, `playwright.config.ts`
- Risk: E2E tests are never run automatically. Regressions are caught only by manual testing.
- Priority: Medium — setting up a GitHub Actions workflow with `supabase start` + `npm run test:e2e` would catch regressions automatically.

---

*Concerns audit: 2026-02-26*
