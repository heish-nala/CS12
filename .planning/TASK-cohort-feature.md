# TASK: Cohort Feature — Client → Cohort Hierarchy

## Goal
Add a `cohorts` layer between clients (DSOs) and their data. Each client can have multiple cohorts (e.g. "Cohort 1", "Cohort 2"). The client overview page becomes a cohort list. All existing client data is migrated into an auto-created "Cohort 1" per client so nothing breaks.

## Context

### Current structure
- `dsos` table = clients (4 exist in production: Smile Partners, Pacific Dental, Aspen Group, etc.)
- `data_tables` → scoped to `client_id` (= `dso.id`)
- `activities` → scoped to `client_id`
- `period_data` → scoped to `table_id` (which belongs to `client_id`)
- `doctors` → scoped to `dso_id`

### What's changing
- Add a `cohorts` table: belongs to a `dso`, has name + start_date + status
- `data_tables` gets a nullable `cohort_id` column
- `activities` gets a nullable `cohort_id` column
- Migration script: for each existing `dso`, create one cohort named "Cohort 1" and set `cohort_id` on all their existing `data_tables` and `activities`

### URL structure
- Current: `/clients/[dsoId]` → shows tabs (Attendees, Overview, Activity, Progress)
- New: `/clients/[dsoId]` → shows cohort cards grid
- New: `/clients/[dsoId]/cohorts/[cohortId]` → shows tabs (Attendees, Overview, Activity, Progress)

### Sidebar
- Currently: flat list of client names
- New: each client has an expand/collapse chevron; cohorts appear as sub-items when expanded
- If a client has 1 cohort → clicking the client name goes directly to that cohort (no need to see a 1-item list)
- If a client has 2+ cohorts → clicking the client name goes to the cohort list page

### Client overview page redesign
- Remove the current tabs (Attendees, Overview, Activity, Progress) from `/clients/[dsoId]`
- Replace with a cohort card grid — each card shows: cohort name, start date, doctor/attendee count, status badge
- "Add Cohort" button creates a new cohort for this client
- Clicking a cohort card navigates to `/clients/[dsoId]/cohorts/[cohortId]`

### Cohort detail page
- New page at `/clients/[dsoId]/cohorts/[cohortId]`
- Breadcrumb: "Client Name › Cohort Name"
- Contains the exact same tabs that currently live on the client page: Attendees, Overview, Activity, Progress
- All existing components (DataTablesView, OverviewDashboard, ActivityTimeline, ProgressTab) are used here unchanged — just passed `cohortId` alongside `clientId`
- API calls that currently use `client_id` will also accept an optional `cohort_id` filter

## Database migration (Supabase)
Create file: `supabase/migrations/20260408000000_add_cohorts.sql`

```sql
-- 1. Create cohorts table
CREATE TABLE cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dso_id UUID NOT NULL REFERENCES dsos(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cohorts_dso_id ON cohorts(dso_id);

-- RLS
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cohorts for their DSOs"
    ON cohorts FOR SELECT
    USING (dso_id IN (SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text));

CREATE POLICY "Users can manage cohorts for their DSOs"
    ON cohorts FOR ALL
    USING (dso_id IN (SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')));

-- 2. Add cohort_id to data_tables and activities (nullable — existing rows stay NULL until migrated)
ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;

-- 3. Auto-create "Cohort 1" for every existing DSO and link existing data
-- This runs as a DO block so it's safe to run multiple times (idempotent via the WHERE NOT EXISTS check)
DO $$
DECLARE
    dso_record RECORD;
    new_cohort_id UUID;
BEGIN
    FOR dso_record IN SELECT id FROM dsos LOOP
        -- Only create if this DSO doesn't already have cohorts
        IF NOT EXISTS (SELECT 1 FROM cohorts WHERE dso_id = dso_record.id) THEN
            INSERT INTO cohorts (dso_id, name, status)
            VALUES (dso_record.id, 'Cohort 1', 'active')
            RETURNING id INTO new_cohort_id;

            -- Link existing data_tables to this cohort
            UPDATE data_tables SET cohort_id = new_cohort_id
            WHERE client_id = dso_record.id AND cohort_id IS NULL;

            -- Link existing activities to this cohort
            UPDATE activities SET cohort_id = new_cohort_id
            WHERE client_id = dso_record.id AND cohort_id IS NULL;
        END IF;
    END LOOP;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_cohorts_updated_at BEFORE UPDATE ON cohorts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## New API route
Create: `src/app/api/cohorts/route.ts`

- `GET /api/cohorts?dso_id=xxx` → returns all cohorts for a DSO (with attendee count per cohort)
- `POST /api/cohorts` → body: `{ dso_id, name, start_date?, status? }` → creates new cohort
- Use `supabaseAdmin` for all queries
- Auth: call `requireOrgDsoAccess(request, dso_id)` before any data access
- Return shape for GET: `{ cohorts: [{ id, dso_id, name, start_date, status, attendee_count, created_at }] }`
- Compute `attendee_count` by counting `data_rows` that belong to `data_tables` with `cohort_id = cohort.id`

## New page
Create: `src/app/clients/[id]/cohorts/[cohortId]/page.tsx`

- Copy the structure of `src/app/clients/[id]/page.tsx` (the `ClientDetailContent` function)
- Breadcrumb shows: `Client Name › Cohort Name`
- Tabs: Attendees, Overview, Activity, Progress (same as today)
- Pass both `clientId` and `cohortId` down to child components
- `DataTablesView` receives `cohortId` prop → passes it as query param to `/api/data-tables?client_id=xxx&cohort_id=xxx`
- `ActivityTimeline` receives `cohortId` prop → passes it as query param to `/api/activities?client_id=xxx&cohort_id=xxx`
- `ProgressTab` receives `cohortId` prop → passes it as query param to `/api/progress?client_id=xxx&cohort_id=xxx`
- `OverviewDashboard` receives `cohortId` prop → passes it to `/api/overview-dashboard?dso_id=xxx&cohort_id=xxx`

## Modified: Client overview page
File: `src/app/clients/[id]/page.tsx`

- Remove the `<Tabs>` block entirely
- Replace with a cohort list fetched from `GET /api/cohorts?dso_id=[id]`
- Render cohort cards in a responsive grid (2–3 columns)
- Each card: cohort name, start date, attendee count, status badge, "→" chevron on hover
- Clicking a card navigates to `/clients/[id]/cohorts/[cohortId]`
- Add "+ Add Cohort" button (top right, same style as current "New Client" button)
- "Add Cohort" opens a small dialog: just a name field + optional start date

## Modified: Sidebar
File: `src/components/layout/notion-sidebar.tsx`

- Each client item in the sidebar gets a `▶` chevron button to expand/collapse
- When expanded, sub-items appear: one per cohort, indented, using a dot icon
- Clicking the chevron toggles expansion (local state per client, stored in `useState` as a Set of expanded client IDs)
- The sidebar already imports `ChevronDown` and `ChevronRight` from lucide-react — use those
- If a client has exactly 1 cohort AND it's the first visit, auto-navigate to that cohort on click (not to the cohort list)
- Sidebar must also show the "+ add cohort" action inline on hover of the client row
- Cohort list comes from the existing `clients` context — extend it OR fetch cohorts lazily when a client row is expanded (lazy is preferred to avoid over-fetching on load)

## Modified: API routes — add optional cohort_id filter

### `src/app/api/data-tables/route.ts` (GET handler only)
- Accept optional `cohort_id` query param
- If `cohort_id` is provided, add `.eq('cohort_id', cohortId)` to the Supabase query
- If not provided, behavior is unchanged (returns all tables for the client)

### `src/app/api/activities/route.ts` (GET handler only)
- Accept optional `cohort_id` query param
- If provided, add `.eq('cohort_id', cohortId)` filter

### `src/app/api/progress/route.ts` (GET handler only)
- Accept optional `cohort_id` query param
- If provided, filter `data_tables` query: add `.eq('cohort_id', cohortId)`

### `src/app/api/overview-dashboard/route.ts` (GET handler only)
- Accept optional `cohort_id` query param
- If provided, filter `data_tables` query to `.eq('cohort_id', cohortId)`

## Modified: New data_tables POST — require cohort_id
File: `src/app/api/data-tables/route.ts` (POST handler)

- Accept `cohort_id` in the request body (required when creating a new table)
- Store it in the `data_tables` insert: `cohort_id: body.cohort_id`
- Return error if `cohort_id` is missing

## Modified: Types
File: `src/lib/db/types.ts`

Add:
```typescript
export type CohortStatus = 'active' | 'completed' | 'archived';

export interface Cohort {
    id: string;
    dso_id: string;
    name: string;
    start_date: string | null;
    status: CohortStatus;
    created_at: string;
    updated_at: string;
    // Computed
    attendee_count?: number;
}
```

Also update `DataTable` interface to include:
```typescript
cohort_id: string | null;
```

And update `Activity` interface to include:
```typescript
cohort_id?: string | null;
```

## Files to touch
- `supabase/migrations/20260408000000_add_cohorts.sql` (NEW — create this file)
- `src/app/api/cohorts/route.ts` (NEW — create this file)
- `src/app/clients/[id]/cohorts/[cohortId]/page.tsx` (NEW — create this file)
- `src/app/clients/[id]/page.tsx` (replace tabs with cohort card grid)
- `src/components/layout/notion-sidebar.tsx` (add expand/collapse + cohort sub-items)
- `src/app/api/data-tables/route.ts` (add cohort_id filter on GET; require cohort_id on POST)
- `src/app/api/activities/route.ts` (add cohort_id filter on GET)
- `src/app/api/progress/route.ts` (add cohort_id filter on GET)
- `src/app/api/overview-dashboard/route.ts` (add cohort_id filter on GET)
- `src/lib/db/types.ts` (add Cohort type, update DataTable + Activity)

## Files NOT to touch
- `src/components/data-tables/data-tables-view.tsx` — just pass cohortId as a prop, don't refactor internals
- `src/components/activities/activity-timeline.tsx` — same, prop only
- `src/components/clients/progress-tab.tsx` — same, prop only
- `src/components/dashboard/overview-dashboard.tsx` — same, prop only
- `src/lib/auth.ts` — do not modify auth helpers
- `supabase/migrations/*` (existing files) — never edit existing migrations
- `src/contexts/clients-context.tsx` — do not change; sidebar fetches cohorts lazily on expand
- Any report-related files (`report-engine.ts`, `report-html-builder.ts`, `report-narratives.ts`)

## Acceptance criteria
- [ ] Running `supabase db push` applies the migration without errors
- [ ] All 4 existing clients each have exactly 1 cohort named "Cohort 1" in the DB after migration
- [ ] All existing `data_tables` rows have a non-null `cohort_id` after migration
- [ ] All existing `activities` rows have a non-null `cohort_id` after migration
- [ ] `/clients/[id]` shows a cohort card grid (not tabs)
- [ ] Each cohort card shows name, start date, attendee count, status badge
- [ ] Clicking a cohort card navigates to `/clients/[id]/cohorts/[cohortId]`
- [ ] `/clients/[id]/cohorts/[cohortId]` shows the Attendees/Overview/Activity/Progress tabs
- [ ] Data shown in the cohort tabs is scoped to that cohort only (not all client data)
- [ ] Sidebar: each client shows a `▶` that expands to show cohort sub-items
- [ ] "Add Cohort" button on client overview creates a new cohort and shows it in the list
- [ ] Creating a new data table requires a `cohort_id` — no orphaned tables
- [ ] No existing data is lost or inaccessible after migration

## Test plan
1. Run `supabase db reset` locally — migration should apply with no errors
2. Open the app at `/clients/[any-existing-client-id]` — should show cohort card grid with one "Cohort 1" card
3. Click "Cohort 1" — should navigate to `/clients/[id]/cohorts/[cohortId]` and show the Attendees tab with all existing attendees
4. Check Activity tab in cohort view — should show all existing activities scoped to this cohort
5. Check Progress tab in cohort view — same data as before
6. Add a new cohort from the client overview page — should appear as a second card
7. Open the sidebar — click `▶` next to a client to expand — both cohorts should appear as sub-items
8. Click a cohort sub-item in the sidebar — should navigate directly to that cohort's page
9. Create a new attendee list inside a cohort — confirm it is created with the correct `cohort_id`
10. Run `npm run build` — no TypeScript or build errors
