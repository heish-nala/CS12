# TASK: Fix Critical Bugs in CS12 Reporting Feature

## Goal
Fix all critical and moderate bugs in the reporting feature so it produces a correct, complete HTML report that can be reliably printed to PDF. This is not a full rewrite — fix the specific broken pieces only.

## Context
The reporting feature is a multi-file system:
- `src/app/clients/[id]/report/page.tsx` — UI: date picker, generate report, download button
- `src/app/api/report/generate-data/route.ts` — API: fetches data, calls report-engine + report-narratives
- `src/app/api/report/export-pdf/route.ts` — API: calls HTML builder, returns filled HTML
- `src/lib/report-engine.ts` — assembles structured ReportData from the database
- `src/lib/report-html-builder.ts` — fills in the HTML template with data
- `public/report-template.html` — the visual template with placeholders

The feature currently returns HTML (not a real PDF) that opens in a new tab for browser print-to-PDF. That is intentional and acceptable — do NOT add a PDF library. Just make the HTML render correctly.

Known bugs that must be fixed:

### Bug 1 — Quote placeholders don't fill (Critical)
**File:** `src/lib/report-html-builder.ts`, lines 19 and 101–120
**Problem:** `[DSO_NAME]` is replaced globally on line 19 before the quote block replacements run. The quote replacements on lines 101–120 still contain `[DSO_NAME]` in their search strings — so they never match and quotes are left empty.
**Fix:** Do NOT replace `[DSO_NAME]` globally on line 19. Instead, replace it as part of each quote block replacement inline. Alternatively, replace `[DSO_NAME]` globally AFTER all quote blocks are substituted (move line 19 to after line 131).

### Bug 2 — Sentiment table regex matches wrong element (Critical)
**File:** `src/lib/report-html-builder.ts`, lines 156–161
**Problem:** The regex `/(<tbody>\s*)(?=.*?Lead Ortho.*?clinical walkthrough)/s` is fragile. When `leadOrtho` has been replaced with a real name (not "Lead Ortho"), the lookahead finds nothing. When it does match, it may match the doctor table `<tbody>` on page 2 instead of the sentiment table on page 6.
**Fix:** Add a unique HTML comment marker (e.g., `<!-- SENTIMENT_TABLE_START -->`) directly before the sentiment table's `<tbody>` in `public/report-template.html`, then replace that marker using a simple string replace instead of the regex.

### Bug 3 — priorActivity shows oldest activity, not second-most-recent (Moderate)
**File:** `src/lib/report-engine.ts`, line 175–176
**Problem:** `doctorActivities` is sorted descending (newest first). `doctorActivities[doctorActivities.length - 1]` is the OLDEST activity.
**Fix:** Change line 176 to `doctorActivities[1]` to get the second-most-recent activity (index 1 in a descending sort).

### Bug 4 — Popup blocked gives no user feedback (Moderate)
**File:** `src/app/clients/[id]/report/page.tsx`, lines 89–96
**Problem:** If `window.open()` is blocked by the browser, `win` is null. The code checks `if (win)` but silently does nothing — user sees no error and gets no report.
**Fix:** After `const win = window.open(...)`, add an `else` branch that calls `setError('Popup blocked. Please allow popups for this site and try again.')`.

### Bug 5 — Hard-coded date defaults (Minor)
**File:** `src/app/clients/[id]/report/page.tsx`, lines 21–22
**Problem:** Dates are hardcoded to `'2026-01-22'` and `'2026-03-19'`.
**Fix:** Default `periodStart` to the first day of the current month and `periodEnd` to today. Use `new Date()` to compute these dynamically on component init.

## Files to touch
- `src/lib/report-html-builder.ts`
- `src/lib/report-engine.ts`
- `src/app/clients/[id]/report/page.tsx`
- `public/report-template.html` (only to add the `<!-- SENTIMENT_TABLE_START -->` comment marker)

## Files NOT to touch
- `src/app/api/report/export-pdf/route.ts`
- `src/app/api/report/generate-data/route.ts`
- `src/lib/report-narratives.ts`
- Any other file in the project

## Acceptance criteria
- [ ] Quote blocks on pages 3, 4, and 5 populate correctly when quotes exist in the data
- [ ] Quote blocks show the "No quotes captured" fallback message when no quotes exist
- [ ] Sentiment table rows appear in the correct table (page 6), not the doctor table (page 2)
- [ ] `priorActivity` column in the doctor table shows the second-most-recent activity, not the oldest
- [ ] When browser blocks the popup, the page shows the error: "Popup blocked. Please allow popups for this site and try again."
- [ ] Date pickers default to the first day of the current month and today's date (not hardcoded 2026 dates)
- [ ] No regressions — doctor table, executive summary, finding narratives, and next steps all still populate correctly

## Test plan
1. Open the report page for a client that has activity data and quotes logged
2. Set dates to cover a known period with data, click Generate Report
3. Click Download — a new tab should open with the HTML report
4. Verify: quote blocks show real doctor quotes (not empty or "[DSO_NAME]" literal)
5. Verify: sentiment table on the last page has rows, doctor table on page 2 is unaffected
6. Verify: doctor table "Prior Activity" column shows second-most-recent activity (not the oldest)
7. Block popups in browser settings, click Download again — error message should appear on the page
8. Reload the page fresh — date fields should default to current month start and today
