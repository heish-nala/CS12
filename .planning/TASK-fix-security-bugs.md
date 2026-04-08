# TASK: Fix Security Bugs — Auth Fallback, Activity Scoping, Doctor Client, Detail Panel, Lint

## Goal
Fix four security/correctness bugs identified in the audit: (1) remove the unauthenticated `user_id` fallback from auth helpers, (2) require `client_id` on all activity reads and inserts, (3) switch the doctors GET route to `supabaseAdmin` instead of the browser client, (4) fix the person detail panel so it returns only one person's activities instead of the whole client's stream. Also fix the P3 lint error (component defined inside render).

## Context

### Bug 1 — Identity spoofing via auth fallback (P0)
`src/lib/auth.ts` has two helpers that accept `user_id` from the URL or request body when no session cookie is present: `requireAuthWithFallback` (line 116) and `requireDsoAccessWithFallback` (line 192). `requireOrgDsoAccess` (line 276) has the same pattern. `src/app/api/team/invite/route.ts` (line 104) also falls back to `invited_by` from the request body if session auth fails, then does a full admin user lookup with that ID.

These fallbacks were added during development to make testing easier. They must be removed. Any caller who can supply a valid UUID can act as that user. Session cookies are the only acceptable proof of identity.

The fix: in `requireAuthWithFallback`, `requireDsoAccessWithFallback`, and `requireOrgDsoAccess`, delete the `else` branches that pull `user_id` from query params or body. If session auth fails, return 401 immediately. In `team/invite/route.ts`, delete the `invited_by` fallback block — if `requireAuth` fails, return the 401 response.

**Important:** Several API routes call `requireAuthWithFallback` and pass `?user_id=` in the URL from the browser client (`person-detail-panel.tsx` line 109 sends `user_id` as a query param). After removing the fallback, those routes will rely solely on session cookies — which is correct for authenticated users. Remove the `user_id` query param from `person-detail-panel.tsx` as well since it won't be used.

### Bug 2 — Activities API not tenant-scoped (P0)
`src/app/api/activities/route.ts` GET handler (line 5) starts a query with `select('*')` from all activities and only applies the `client_id` filter when `client_id` is present in the query string. If `client_id` is omitted, line 93 runs the unfiltered query and returns all activities across all clients.

The fix: in the GET handler, make `client_id` required. If it is missing or empty, return a 400 error: `{ error: 'client_id is required' }`.

For the POST handler (line 110): currently, if `client_id` is omitted in the body, the code falls through to a block (line 190) that still allows inserts without verifying which client/DSO the activity belongs to. The fix: if `client_id` is not provided in the POST body, return 400: `{ error: 'client_id is required' }`. Do not allow clientless inserts.

### Bug 3 — Doctor API uses browser client on server (P1)
`src/app/api/doctors/route.ts` line 47 builds its main query using `supabase` (the browser client exported from `src/lib/db/client.ts` line 10, created with `createBrowserClient`). Browser clients are meant for use in the browser only — they rely on cookies being present in a browser context. On the server, this client has no valid session and bypasses or misapplies RLS.

The fix: change `supabase` to `supabaseAdmin` on every line in `src/app/api/doctors/route.ts` and `src/app/api/doctors/[id]/route.ts` where `supabase` is used to query the database. Both files already import `supabaseAdmin` from `@/lib/db/client`. Just replace the usages.

### Bug 4 — Person detail panel shows wrong activities (P2)
`src/components/person-detail-panel.tsx` sends `?client_id=...&contact_name=...` (line 100–106). In `activities/route.ts`, lines 46–52 apply `doctor_id` and `contact_name` filters to `query`, but line 58 builds a brand-new query with `supabaseAdmin.from('activities').select('*').or(...)` and discards those filters entirely. The result is all activities for the client, not just this person's.

After fixing Bug 2 (requiring `client_id`), also fix the filter logic: when `contact_name` is provided alongside `client_id`, apply it as an additional filter on top of the client-scoped query, not as a replacement for it. Specifically, after line 63 (the `.or(client_id.eq.X, doctor_id.in.(Y))` query is built), chain `.eq('contact_name', contactName)` onto the same query object when `contactName` is present.

### Bug 5 — Lint error: component defined inside render (P3)
`src/components/dashboard/dashboard-config-dialog.tsx` line 181 defines `CategorySection` as a `const` function component inside the body of another component's render. This triggers the ESLint rule `react-hooks/static-components` and also risks state bugs if `CategorySection` ever has children with state.

The fix: move `CategorySection` outside of the parent component's function body, to the module level (before the parent component's `export default` or `export function` declaration). It receives `category` as a prop, which is fine — just make sure any variables it references (`getCategoryMetrics`, `getCategoryLabel`, `handleToggle`) are either passed as props or are stable module-level functions. Inspect what `CategorySection` uses before moving it.

## Files to touch
- `src/lib/auth.ts`
- `src/app/api/activities/route.ts`
- `src/app/api/doctors/route.ts`
- `src/app/api/doctors/[id]/route.ts`
- `src/app/api/team/invite/route.ts`
- `src/components/person-detail-panel.tsx`
- `src/components/dashboard/dashboard-config-dialog.tsx`

## Files NOT to touch
- `src/lib/db/client.ts` — `supabase` (browser client) and `supabaseAdmin` are both correct exports; don't change them
- Any migration files in `supabase/migrations/`
- Any other file not listed above

## Acceptance criteria
- [ ] Calling any API route with `?user_id=some-uuid` and no session cookie returns 401 (not data)
- [ ] Sending `{ invited_by: "some-uuid" }` to `/api/team/invite` with no session cookie returns 401
- [ ] GET `/api/activities` without `client_id` returns 400
- [ ] POST `/api/activities` without `client_id` in the body returns 400
- [ ] GET `/api/activities?client_id=X&contact_name=Y` returns only activities where `contact_name = Y`, not all activities for client X
- [ ] GET `/api/doctors?dso_id=X` returns doctor records (not empty) for an authenticated user who has access to that DSO
- [ ] `npm run lint` passes with 0 errors (the `react-hooks/static-components` error from `dashboard-config-dialog.tsx` is gone)
- [ ] `npm run build` passes

## Test plan
1. Start the dev server: `npm run dev`
2. Open browser DevTools → Network tab
3. Make a GET request to `/api/activities` with no session (e.g. from an incognito tab) — expect 401
4. Make a GET request to `/api/activities?client_id=<valid-id>` with no session — expect 401
5. Make a GET request to `/api/activities?client_id=<valid-id>` with no session but add `?user_id=<any-uuid>` — expect 401 (not data)
6. Log in as a real user, open a client page, open a contact's detail panel — confirm it shows only that contact's activities
7. Run `npm run lint` — confirm 0 errors
8. Run `npm run build` — confirm it passes
