# CS12 Platform — Codex Implementation Handoff

## Date: March 5, 2026

## Project Context

**What this is:** CS12 is a customer success platform for tracking doctor/dentist onboarding programs. Built with Next.js 16 (App Router), Supabase (PostgreSQL), TypeScript, Tailwind CSS + shadcn/ui.

**Current state:** The platform has an "Attendee Tracker" (data tables system) that stores all real attendee data. There's also a legacy `doctors` + `period_progress` table system that the main dashboard still reads from — but those tables are empty. The dashboard shows all zeros because of this.

**Goal:** Migrate the dashboard to read from data tables, add clinical analytics, connect activities to attendees, and retire the legacy tables.

---

## Prerequisites

Before starting, confirm:
1. The **metric IDs migration** (`20260305000000_restore_metric_ids.sql`) has been pushed to production
2. Local Supabase is running: `supabase status` (start with `supabase start` if needed)

---

## Step 1: Normalize Status Options Everywhere (Item 6c)

### Problem
Status options are inconsistent across three creation paths:
- **Template** (`src/lib/mock-data.ts` line 89-95): Uses correct options (Not Started, Active, Completed, On Hold, Withdrawn)
- **Attendee List creation** (`src/app/api/data-tables/route.ts` lines 96-103): Uses OLD options (At Risk, Inactive)
- **CSV import** (`src/components/data-tables/import-csv-dialog.tsx` lines 52-58): Uses OLD options (At Risk, Inactive)

### Changes

#### 1a. Fix `src/app/api/data-tables/route.ts`

Replace the `ATTENDEE_LIST_COLUMNS` constant (lines 91-103) — update the Status column options:

```typescript
const ATTENDEE_LIST_COLUMNS = [
    { name: 'Name', type: 'text', is_primary: true, is_required: true },
    { name: 'Email', type: 'email' },
    { name: 'Phone', type: 'phone' },
    { name: 'Blueprint', type: 'percentage', config: { default_value: 0 } },
    { name: 'Status', type: 'status', config: { options: [
        { id: 's1', value: 'not_started', label: 'Not Started', color: 'gray', group: 'todo' },
        { id: 's2', value: 'active', label: 'Active', color: 'blue', group: 'in_progress' },
        { id: 's3', value: 'completed', label: 'Completed', color: 'green', group: 'complete' },
        { id: 's4', value: 'on_hold', label: 'On Hold', color: 'yellow', group: 'in_progress' },
        { id: 's5', value: 'withdrawn', label: 'Withdrawn', color: 'red', group: 'complete' },
    ] } },
];
```

Note: This path does NOT include the Role column — that's only in the template. Consider adding Role here too for consistency. The template has it at line 82-87 of `mock-data.ts`.

#### 1b. Fix `src/components/data-tables/import-csv-dialog.tsx`

Replace the `STANDARD_COLUMNS` constant (lines 51-58) — same status options:

```typescript
const STANDARD_COLUMNS = [
    { name: 'Blueprint', type: 'percentage' as ColumnType, config: { default_value: 0 } },
    { name: 'Status', type: 'status' as ColumnType, config: { options: [
        { id: 's1', value: 'not_started', label: 'Not Started', color: 'gray', group: 'todo' },
        { id: 's2', value: 'active', label: 'Active', color: 'blue', group: 'in_progress' },
        { id: 's3', value: 'completed', label: 'Completed', color: 'green', group: 'complete' },
        { id: 's4', value: 'on_hold', label: 'On Hold', color: 'yellow', group: 'in_progress' },
        { id: 's5', value: 'withdrawn', label: 'Withdrawn', color: 'red', group: 'complete' },
    ] } },
];
```

#### 1c. Database migration: Backfill existing rows with old status values

Create migration: `supabase migration new normalize_status_values`

```sql
-- Backfill deprecated status values in data_rows
-- Status values are stored in data_rows.data as { [column_id]: "status_value" }
-- We need to find Status columns and update their values in row data

-- Update any rows using 'at_risk' to 'on_hold'
UPDATE data_rows
SET data = jsonb_set(data, ARRAY[dc.id], '"on_hold"')
FROM data_columns dc
WHERE dc.table_id = data_rows.table_id
  AND dc.name = 'Status'
  AND dc.type = 'status'
  AND data_rows.data ->> dc.id = 'at_risk';

-- Update any rows using 'inactive' to 'withdrawn'
UPDATE data_rows
SET data = jsonb_set(data, ARRAY[dc.id], '"withdrawn"')
FROM data_columns dc
WHERE dc.table_id = data_rows.table_id
  AND dc.name = 'Status'
  AND dc.type = 'status'
  AND data_rows.data ->> dc.id = 'inactive';

-- Also update the Status column configs themselves to remove old options
UPDATE data_columns
SET config = jsonb_set(
  config,
  '{options}',
  '[
    {"id":"s1","value":"not_started","label":"Not Started","color":"gray","group":"todo"},
    {"id":"s2","value":"active","label":"Active","color":"blue","group":"in_progress"},
    {"id":"s3","value":"completed","label":"Completed","color":"green","group":"complete"},
    {"id":"s4","value":"on_hold","label":"On Hold","color":"yellow","group":"in_progress"},
    {"id":"s5","value":"withdrawn","label":"Withdrawn","color":"red","group":"complete"}
  ]'::jsonb
)
WHERE name = 'Status'
  AND type = 'status'
  AND (
    config->'options' @> '[{"value":"at_risk"}]'::jsonb
    OR config->'options' @> '[{"value":"inactive"}]'::jsonb
  );

-- Same for statusConfig.options format
UPDATE data_columns
SET config = jsonb_set(
  config,
  '{statusConfig,options}',
  '[
    {"id":"s1","value":"not_started","label":"Not Started","color":"gray","group":"todo"},
    {"id":"s2","value":"active","label":"Active","color":"blue","group":"in_progress"},
    {"id":"s3","value":"completed","label":"Completed","color":"green","group":"complete"},
    {"id":"s4","value":"on_hold","label":"On Hold","color":"yellow","group":"in_progress"},
    {"id":"s5","value":"withdrawn","label":"Withdrawn","color":"red","group":"complete"}
  ]'::jsonb
)
WHERE name = 'Status'
  AND type = 'status'
  AND config->'statusConfig'->'options' IS NOT NULL
  AND (
    config->'statusConfig'->'options' @> '[{"value":"at_risk"}]'::jsonb
    OR config->'statusConfig'->'options' @> '[{"value":"inactive"}]'::jsonb
  );
```

### Verification
1. `supabase db reset` — migration runs clean
2. `npm run build` — zero errors
3. Create a new Attendee List from UI → Status column shows: Not Started, Active, Completed, On Hold, Withdrawn (no At Risk, no Inactive)
4. Import a CSV → auto-added Status column has same 5 options
5. Check existing rows in Supabase Studio → no `at_risk` or `inactive` values remain

### Commit
```
git add src/app/api/data-tables/route.ts src/components/data-tables/import-csv-dialog.tsx supabase/migrations/
git commit -m "Normalize status options across all creation paths

Align ATTENDEE_LIST_COLUMNS and CSV import STANDARD_COLUMNS with the
canonical status set (Not Started, Active, Completed, On Hold, Withdrawn).
Backfill existing rows: at_risk → on_hold, inactive → withdrawn."
```

---

## Step 2: Rebuild Main Dashboard from Data Tables (Item 7)

### Problem
`/api/dashboard/metrics` (the main dashboard endpoint) queries the legacy `doctors` + `period_progress` tables, which are empty. Meanwhile `src/lib/attendee-tracker.ts` already has `computeClientMetrics()` that correctly reads from data tables. We need to rewrite the dashboard endpoint to use this existing service.

### Architecture

```
src/lib/attendee-tracker.ts          ← SHARED SERVICE (already exists)
  ├── findAttendeeTables(clientId)   ← finds attendee tables for a client
  └── computeClientMetrics(clientId) ← computes per-client metrics

src/app/api/clients/overview/        ← ALREADY uses computeClientMetrics ✓
src/app/api/dashboard/metrics/       ← STILL uses legacy doctors table ✗ (fix this)
```

### Changes

#### 2a. Expand `src/lib/attendee-tracker.ts` — add aggregate metrics function

Add a new function `computeGlobalDashboardMetrics(clientIds: string[])` that aggregates across multiple clients. This replaces the entire legacy dashboard calculation.

```typescript
export interface GlobalDashboardMetrics {
    total_doctors: number;
    active_doctors: number;
    total_attendees: number;
    active_attendees: number;
    avg_blueprint: number;
    doctors_needing_attention: number;
    // Clinical metrics (current period)
    total_scans: number;
    total_accepted: number;
    total_diagnosed: number;
    // Acceptance rate
    case_acceptance_rate: number; // accepted / diagnosed * 100
    // Confidence gap
    confidence_gap_count: number; // Blueprint >= 80 AND accepted = 0, doctors only
    // Engagement
    recent_activities_count: number;
    engagement_rate: number;
}
```

This function should:
1. Call `findAttendeeTables()` for each client (in parallel with `Promise.all`)
2. Aggregate totals across all tables
3. For doctor-only metrics: filter rows where Role column value = 'doctor'
4. For clinical metrics: query `period_data` for current month, resolve metric IDs via `time_tracking.metrics`
5. **Confidence gap**: count doctor-role rows with Blueprint >= 80 AND current-period accepted = 0
6. **Acceptance rate**: total accepted / total diagnosed * 100 (guard divide-by-zero)
7. For engagement: query `activities` table for last 7 days, count unique client_ids that have activity

#### 2b. Rewrite `src/app/api/dashboard/metrics/route.ts`

Replace the entire function body. Keep the auth + DSO access logic (lines 7-58), then replace everything from line 82 onward:

```typescript
import { computeGlobalDashboardMetrics } from '@/lib/attendee-tracker';

// ... after getting accessibleDsoIds ...

const metrics = await computeGlobalDashboardMetrics(accessibleDsoIds);
return NextResponse.json(metrics);
```

#### 2c. Update `DashboardMetrics` type in `src/lib/db/types.ts`

Replace the current `DashboardMetrics` interface (lines 189-211) with the new shape from 2a. Remove legacy fields: `total_cases_this_month`, `total_courses_this_month`, `risk_distribution`, `avg_cases_per_doctor`, `avg_courses_per_doctor`, `on_track_count`, `completion_rate`.

#### 2d. Update dashboard UI components

Find all components that consume `DashboardMetrics` and update them to use the new field names. Search for these imports:

```bash
grep -r "DashboardMetrics" src/components/
grep -r "total_cases_this_month\|total_courses_this_month\|risk_distribution\|avg_cases_per_doctor" src/components/
```

Update each component to render the new metrics. Key mappings:
- `total_doctors` → same name, now from data tables
- `active_doctors` → same name, filtered by Role=Doctor AND Status=Active
- `at_risk_count` → rename to `confidence_gap_count`
- `total_cases_this_month` → `total_accepted` (or remove if not displayed)
- `doctors_needing_attention` → same name, now Blueprint >= 80 + accepted = 0

### Verification
1. `npm run build` — zero errors
2. `npm run dev` → navigate to main dashboard
3. Dashboard should show non-zero values for DSOs that have attendee data
4. Confirm `total_doctors` matches count of Role=Doctor rows
5. Confirm clinical metrics match period_data totals for current month
6. No remaining references to legacy `doctors` or `period_progress` in dashboard route

### Commit
```
git add src/lib/attendee-tracker.ts src/app/api/dashboard/metrics/route.ts src/lib/db/types.ts src/components/
git commit -m "Rebuild main dashboard to read from data tables

Replace legacy doctors/period_progress queries with shared
attendee-tracker service. Dashboard now shows real attendee data
from data tables, filtered by Role for doctor-specific metrics."
```

---

## Step 3: Confidence Gap Detection (Item 8)

### Problem
Need to surface doctors with Blueprint >= 80% but 0 accepted cases in current period. These are the highest-risk behavioral segment.

### Changes

This is mostly done in Step 2 (the `confidence_gap_count` field in `computeGlobalDashboardMetrics`). This step adds the **list** of those doctors so the dashboard can show names, not just a count.

#### 3a. In `src/lib/attendee-tracker.ts`

Add to the return type:
```typescript
confidence_gap_doctors: Array<{
    name: string;
    blueprint: number;
    client_name: string;
}>;
```

In the computation:
- For each attendee table, find the Name column (is_primary = true or name = 'Name')
- For doctor-role rows with Blueprint >= 80 and accepted = 0, collect their name + blueprint value
- Include the client name (from `dsos` table join) for context

#### 3b. Dashboard UI

Add a "Needs Intervention" card/section that shows the count as a number and, on click/expand, lists the doctor names with their Blueprint % and DSO name.

### Verification
- Doctors with Blueprint 79% are excluded
- Non-doctor rows (Leadership, Staff) are excluded even if Blueprint >= 80
- Count matches what you see manually filtering the attendee table

### Commit
```
git commit -m "Add confidence gap detection to dashboard

Surface doctors with Blueprint >= 80% and 0 accepted cases.
Shows count on dashboard card with expandable doctor list."
```

---

## Step 4: Case Acceptance Rate (Item 9)

### Problem
Need accepted/diagnosed ratio per doctor and overall cohort.

### Changes

#### 4a. Already computed in Step 2
The `case_acceptance_rate` field is already in `GlobalDashboardMetrics`. This step adds per-doctor breakdown.

#### 4b. In `src/lib/attendee-tracker.ts`

Add to return type:
```typescript
acceptance_rate_breakdown: Array<{
    name: string;
    diagnosed: number;
    accepted: number;
    rate: number; // percentage
    flagged: boolean; // diagnosed > 0 but accepted = 0
}>;
```

Compute from period_data: for each doctor-role row, sum their accepted and diagnosed from current period, calculate rate.

#### 4c. Dashboard UI

Add an "Acceptance Rate" metric card showing the cohort number. Optionally show per-doctor breakdown in a table or list view.

### Verification
- Cohort rate = total_accepted / total_diagnosed * 100
- Doctors with diagnosed > 0 and accepted = 0 are flagged
- Division by zero guarded (when diagnosed = 0, rate = N/A or 0)

### Commit
```
git commit -m "Add case acceptance rate metric to dashboard

Shows cohort-level accepted/diagnosed ratio and flags doctors
with diagnosed > 0 but accepted = 0 as checkout problems."
```

---

## Step 5: Connect Activities to Attendee Rows (Item 10)

### Problem
All 36 activities have `doctor_id = null`. Activities are standalone call logs with no link to attendee rows. You can't see "Dr. Matta — 3 calls, last one was no-answer."

### Changes

#### 5a. Database migration

Create migration: `supabase migration new add_data_row_id_to_activities`

```sql
-- Add nullable FK from activities to data_rows
ALTER TABLE activities ADD COLUMN data_row_id UUID REFERENCES data_rows(id) ON DELETE SET NULL;

-- Index for querying activities by attendee row
CREATE INDEX idx_activities_data_row_id ON activities(data_row_id) WHERE data_row_id IS NOT NULL;
```

#### 5b. Update `src/app/api/activities/route.ts`

**GET handler:**
- Accept optional `data_row_id` query parameter
- When provided, filter activities by `data_row_id`

**POST handler:**
- Accept optional `data_row_id` in the request body
- Store it when creating the activity

#### 5c. Update `Activity` type in `src/lib/db/types.ts`

Add to the `Activity` interface:
```typescript
data_row_id?: string; // FK to data_rows.id
```

#### 5d. Update the Activity Logger UI

In the person detail panel (`src/components/person-detail-panel.tsx` or wherever activities are logged from the attendee view):
- When logging an activity from an attendee row, automatically pass the `data_row_id`
- Show linked activities in the attendee detail panel

#### 5e. Activity metrics per attendee

In `src/lib/attendee-tracker.ts`, add a helper function:
```typescript
export async function getAttendeeActivityStats(rowId: string): Promise<{
    total_calls: number;
    last_contact_date: string | null;
    calls_answered: number;
    calls_unanswered: number;
}>;
```

### Verification
1. Create a new activity from an attendee's detail panel → `data_row_id` is set in database
2. Query activities by `data_row_id` → returns only that attendee's activities
3. Existing activities (with null `data_row_id`) still display normally
4. Activity count shows correctly in attendee panel

### Commit
```
git commit -m "Connect activities to attendee rows

Add data_row_id FK to activities table. Activities logged from
attendee detail panel automatically link to the row. Enables
per-attendee activity stats (call count, last contact, answer rate)."
```

---

## Step 6: Retire Doctors Table (Item 11)

### Problem
After Steps 2 and 5, nothing reads from `doctors` or `period_progress`. Remove the dead code paths.

### Changes

#### 6a. Remove/deprecate API routes

These routes still reference `doctors` or `period_progress`:
- `src/app/api/doctors/route.ts` — DELETE entire route
- `src/app/api/doctors/[id]/route.ts` — DELETE entire route
- `src/app/api/doctors/[id]/periods/route.ts` — DELETE entire route
- `src/app/api/activities/route.ts` — Remove `doctor_id` query param support (keep `data_row_id`)
- `src/app/api/tasks/route.ts` — Remove `doctor_id` references if any
- `src/app/api/search/route.ts` — Remove `doctors` table from search

#### 6b. Remove legacy type references

In `src/lib/db/types.ts`:
- Keep `Doctor`, `PeriodProgress`, `DoctorStatus` interfaces for now (don't delete types that might be imported elsewhere)
- But mark them with `/** @deprecated Use data tables instead */`

#### 6c. Remove navigation/sidebar items

Search for links or menu items pointing to `/doctors` or doctor-related pages. Remove them from sidebar/nav components.

#### 6d. Do NOT drop database tables yet

Keep `doctors` and `period_progress` tables in the database for one more milestone. Just stop routing to them. A future migration will drop them after confirming nothing breaks.

### Verification
1. `npm run build` — zero errors (no broken imports)
2. No frontend navigation leads to doctor-specific routes
3. Dashboard still works (now reading from data tables)
4. Activities still work (now linked via `data_row_id`)

### Commit
```
git commit -m "Retire legacy doctors routes and navigation

Remove API routes for doctors and period_progress. Dashboard
now fully reads from data tables. Legacy tables kept in DB
for safety but no longer referenced by application code."
```

---

## Execution Order & Dependencies

```
Step 1 (Status normalization) ──────────┐
                                         ├──→ Step 2 (Dashboard rewrite)
                                         │        │
                                         │        ├──→ Step 3 (Confidence gap)
                                         │        ├──→ Step 4 (Acceptance rate)
                                         │        │
Step 5 (Activities → rows) ─────────────┤        │
    (can run in parallel with Steps 2-4) │        │
                                         │        │
                                         └────────┴──→ Step 6 (Retire doctors)
```

Steps 3 and 4 are small additions to Step 2's work — they can be done as part of Step 2 or immediately after.

Step 5 is independent and can be done in parallel with Steps 2-4.

Step 6 must come last (after Steps 2 and 5 are both complete).

---

## Key Files Reference

| File | Role |
|------|------|
| `src/lib/attendee-tracker.ts` | **Shared metrics service** — expand this, don't create new files |
| `src/app/api/dashboard/metrics/route.ts` | Main dashboard API — rewrite to use attendee-tracker |
| `src/app/api/clients/overview/route.ts` | Already uses attendee-tracker ✓ |
| `src/app/api/data-tables/route.ts` | Table creation — fix status options |
| `src/components/data-tables/import-csv-dialog.tsx` | CSV import — fix status options |
| `src/lib/db/types.ts` | Type definitions — update DashboardMetrics |
| `src/lib/mock-data.ts` | Template definitions — already correct ✓ |
| `src/app/api/activities/route.ts` | Activities API — add data_row_id support |

## Key Architecture Rules

1. **Row data is keyed by column UUID, not column name.** To read a row's Status value, you must first find the Status column's ID, then read `row.data[columnId]`.
2. **Metric data is keyed by metric ID.** The `period_data.metrics` field is `Record<string, number>` where keys are metric IDs from `data_tables.time_tracking.metrics[].id`.
3. **Use `findAttendeeTables()`** to discover attendee tables — don't hardcode table IDs.
4. **Doctor filtering uses Role column** — find the Role column, check if row's value matches 'doctor'.

## Testing Protocol

For each step:
1. `supabase db reset` — test migrations locally
2. `npm run build` — zero TypeScript errors
3. `npm run dev` — manual smoke test
4. Only after local testing: `supabase db push` to production
