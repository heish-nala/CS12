# CS12 Platform — Implementation Plan

## Date: March 3, 2026
## Decision: Data Tables as Single Source of Truth

---

## Architecture Decision

**What we decided:** Make the Attendee Tracker (data tables) the single source of truth for all people in the program. Retire the empty doctors table. Rebuild the dashboard to pull from data tables instead.

**Why:** The doctors table is empty. All 30 real attendees live in the data tables. Running two parallel systems means double data entry and a dashboard that shows zeros.

---

## Implementation Items

### 1. Add "Role" Column to Attendee Tracker Template

**What:** Add a new column type to the Attendee Tracker template so each row can be tagged as Doctor, Leadership, Staff, or Other.

**Why:** NADG has 16 attendees — 11 doctors and 5 leadership. Right now there's no way to tell them apart. Leadership shouldn't count toward clinical metrics (scans, accepted, diagnosed), but we still want to see that they're enrolled and attending.

**Changes needed:**
- Update the Attendee Tracker template to include a "Role" column (type: status) with options: Doctor, Leadership, Staff, Other
- For existing attendee rows across all 4 DSOs, backfill the Role column (we know which are doctors vs. leadership from the data)
- The UI already supports status-type columns, so this should just work in the data table view

**Impact:** Low risk. Adding a column doesn't break anything.

---

### 2. Rebuild Dashboard to Read from Data Tables

**What:** The dashboard currently queries the (empty) doctors table. Rewrite it to query data_table_rows from Attendee Tracker tables, filtered to Role = "Doctor" only.

**Why:** This is why the dashboard shows all zeros — it's looking at the wrong table.

**Changes needed:**
- Rewrite `/api/dashboard/metrics` to:
  - Find all data_tables with template_id = 'attendee-tracker' (or similar identifier) for the user's accessible clients
  - Pull rows from those tables
  - Filter to Role = Doctor only
  - Calculate metrics from the row data (Blueprint %, status) and time-tracking periods (scans, accepted, diagnosed)
- Dashboard metrics to calculate:
  - Total doctors (Role = Doctor across all DSOs)
  - Active doctors (Status = Active)
  - Average Blueprint completion
  - Total scans / accepted / diagnosed this period
  - Case acceptance rate (accepted / diagnosed)
  - Doctors needing attention (high Blueprint % + 0 cases = confidence gap flag)
- Update dashboard UI components to display the new metrics

**Impact:** High value. This is the single biggest fix — makes the dashboard actually useful.

**Complexity:** Medium-high. The tricky part is that data_table rows store values as JSON keyed by column UUID, so the dashboard API needs to resolve column IDs to know which column is "Blueprint", which is "Role", etc.

---

### 3. Add "Confidence Gap" Detection

**What:** Surface doctors who completed the Blueprint (80%+) but have 0 accepted cases. These are the doctors in the "conscious incompetence" dip from the report.

**Why:** Finding #1 from the program report. These doctors look fine on paper (high Blueprint %) but are actually the ones most at risk of dropping off.

**Changes needed:**
- In the dashboard metrics calculation, cross-reference Blueprint % with accepted cases from time-tracking periods
- Add a new metric: "Needs Intervention" — doctors with Blueprint >= 80% AND accepted = 0
- Display this on the dashboard as a callout or alert card

**Impact:** Directly addresses the #1 finding from the report.

---

### 4. Add Case Acceptance Rate Metric

**What:** Calculate and display accepted / diagnosed ratio per doctor and as a cohort average.

**Why:** Finding #2 from the report. Doctors are scanning and diagnosing but losing patients at checkout. We need to see this pattern in the data, not just hear about it on calls.

**Changes needed:**
- Pull "Accepted" and "Diagnosed" from time-tracking period data
- Calculate ratio per doctor and across the cohort
- Display on dashboard and/or doctor detail view
- Flag doctors with diagnosed > 0 but accepted = 0 as having a "checkout problem"

**Impact:** Makes the checkout problem visible at a glance.

---

### 5. Connect Activities to Attendee Rows

**What:** Right now all 36 activities have doctor_id = null. They're standalone call logs. Link activities to attendee rows so you can see "Dr. Matta — 3 calls, last one was a no-answer" directly in the data table or doctor profile.

**Why:** Contact attempt tracking was Finding #5. You can't see who's unreachable without reading every individual call note.

**Changes needed:**
- Add a `data_row_id` column to the activities table (optional FK to data_rows)
- When logging an activity, allow selecting which attendee it's for
- In the attendee row detail view, show linked activities
- Calculate: total calls, last contact date, answer rate

**Impact:** Medium. This connects the two main data entry workflows (call logging and attendee tracking).

---

### 6. Retire the Doctors Table

**What:** Stop using the doctors table, period_progress table, and related API routes. Don't delete them yet — just stop routing to them.

**Why:** Once the dashboard reads from data tables and activities link to attendee rows, the doctors table serves no purpose.

**Changes needed:**
- Mark doctors-related API routes as deprecated
- Remove doctors-related navigation from the UI
- Keep the database tables for now (no data loss risk)
- Remove doctor-related menu items from sidebar

**Impact:** Cleanup. Reduces confusion about where to enter data.

---

## Implementation Order

| Order | Item | Depends On | Estimated Scope |
|-------|------|------------|-----------------|
| 1 | Add Role column to Attendee Tracker | Nothing | Small — template + migration |
| 2 | Rebuild dashboard from data tables | #1 (needs Role to filter) | Large — API rewrite + UI updates |
| 3 | Confidence gap detection | #2 (needs dashboard reading from data tables) | Small — additional metric calculation |
| 4 | Case acceptance rate metric | #2 (same dependency) | Small — additional metric calculation |
| 5 | Connect activities to attendee rows | Nothing (can parallel with #2) | Medium — schema change + UI |
| 6 | Retire doctors table | #2 and #5 complete | Small — remove routes + nav items |

---

### 6b. Replace Overview Tab with Pre-Built Dashboard

**What:** Remove the current "Configure Widgets" system on the Overview tab. Replace it with a fixed, pre-built dashboard that automatically shows the right metrics from the Attendee Tracker data — no configuration needed.

**Why:** The current widget builder requires users to manually configure each metric (pick a data source, choose aggregation type, etc.). That's not intuitive for daily use. Since all 4 DSOs use the same Attendee Tracker template, the Overview should just show what matters automatically.

**Pre-built widgets to display:**
- **Attendees by Status** — bar or donut chart (Not Started, Active, Completed, On Hold, Withdrawn)
- **Attendees by Role** — bar chart (Doctor, Leadership, Staff, Other)
- **Blueprint Completion** — average % across all doctors, plus distribution (0-25%, 26-50%, 51-75%, 76-100%)
- **Clinical Funnel** — Diagnosed → Scans → Accepted → Cases Submitted (current period totals)
- **Activity Summary** — total calls this month, last contact date, answer rate

**Changes needed:**
- Rewrite `src/components/dashboard/executive-dashboard.tsx` to pull data directly from Attendee Tracker rows (same source as the Attendees tab)
- Remove `src/components/dashboard/overview-config-dialog.tsx` (the widget configuration modal)
- Remove or deprecate the `overview_widgets` table and `/api/overview-widgets` endpoints
- No "Configure Widgets" button — it just renders the fixed dashboard

**Decision:** Option C chosen over Puck (drag-and-drop editor) or React Grid Layout (custom grid). Reasoning: all DSOs share the same template, so custom widget configuration is unnecessary complexity right now. If DSOs diverge in the future, we can add Puck or React Grid Layout then.

**Impact:** Medium. Simplifies the UX significantly. Users see useful data immediately instead of a blank "No Widgets Configured" page.

---

### 7. Update Status Column Options

**What:** Replace the current Status options with clearer ones that fold in onboarding state.

**Current options:** Not Started, Active, At Risk, Completed, Inactive

**New options:**
- **Not Started** — enrolled but not yet onboarded
- **Active** — onboarded and working through the program
- **Completed** — finished the program
- **On Hold** — paused (e.g., Dr. Lannom, no office until July)
- **Withdrawn** — left the program

**Why:** "At Risk" should be calculated by the dashboard, not manually tagged. "Not Started" doubles as the pre-onboarding state — when you onboard someone, you flip them to Active. No separate Onboarding column needed.

**Changes needed:**
- Update the Attendee Tracker template status options in `src/lib/mock-data.ts`
- Update any existing rows that use "At Risk" or "Inactive" to the new values
- Update status option colors to match new meanings

**File:** `src/lib/mock-data.ts` (template definition)

**Impact:** Low risk. UI already renders status columns dynamically from config.

---

### 8. Add Copy Buttons to Detail Panel (Email & Phone)

**What:** The side panel that opens when you click an attendee row shows email and phone as links but has no copy button. Add the same click-to-copy behavior that already works in the main data table.

**Current behavior (person-detail-panel.tsx, lines 229-244):**
```
📧 doctor@email.com        ← link only, no copy
📞 555-123-4567            ← link only, no copy
```

**New behavior:**
```
📧 doctor@email.com  📋    ← click copy icon → "Email copied" toast
📞 555-123-4567      📋    ← click copy icon → "Phone number copied" toast
```

**Changes needed:**
- Add copy button next to email display (line ~232) in `src/components/person-detail-panel.tsx`
- Add copy button next to phone display (line ~240) in same file
- Reuse the exact copy pattern from `src/components/data-tables/data-grid.tsx` (lines 735-790)
- Uses `navigator.clipboard.writeText()` + toast notification + checkmark feedback

**Impact:** Tiny change. Improves daily workflow for Claudia logging calls.

---

### 9. Show Actual Dates on Activities (Not Relative Time)

**What:** Activity entries currently show "Today", "Yesterday", "3 days ago", "2 weeks ago". Change to show actual dates like "Feb 27, 2026".

**Current behavior (person-detail-panel.tsx, lines 207-217):**
Custom `formatRelativeDate()` function returns relative strings.

**New behavior:**
Show formatted date: "Feb 27, 2026"

**Changes needed:**
- Replace `formatRelativeDate()` function in `src/components/person-detail-panel.tsx` (line 207)
- New format: `date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`
- Also check `src/components/activities/activity-timeline.tsx` for the same pattern

**Impact:** Tiny change. One function swap.

---

### 10. Reorder Time-Tracking Metrics to Match Clinical Funnel

**What:** Current order is Scans, Accepted, Diagnosed. Should follow the clinical pipeline: Diagnosed → Scans → Accepted → Cases Submitted (new).

**Why:** The funnel reads left to right: doctor diagnoses the patient, scans them, patient accepts treatment, doctor submits the case. Current order is jumbled.

**Changes needed:**
- Reorder metrics in Attendee Tracker template to: Diagnosed, Scans, Accepted, Cases Submitted
- Add "Cases Submitted" as a new time-tracking metric (this is the final step — ClinCheck sent to aligner company)
- Update template definition in `src/lib/mock-data.ts`

**Impact:** Low risk. Existing data stays — just column display order changes + one new metric.

---

## Updated Implementation Order

| Order | Item | Depends On | Scope | Status |
|-------|------|------------|-------|--------|
| 1 | Add Role column | Nothing | Small | DONE |
| 2 | Update Status options | Nothing | Small | DONE |
| 3 | Reorder time-tracking metrics | Nothing | Small | DONE (Cases Submitted rolled back) |
| 4 | Copy buttons on detail panel | Nothing | Tiny | DONE |
| 5 | Actual dates on activities | Nothing | Tiny | DONE |
| 6 | Replace Overview tab with pre-built dashboard | #1, #2, #3 | Medium | DONE |
| 6b | Remove Cases Submitted + copy buttons on Progress panel | Nothing | Small | DONE (Mar 3) |
| **7** | **Rebuild main dashboard from data tables** | #1, #2 | **Large** | **NEXT** |
| 8 | Confidence gap detection | #7 | Small | Not started |
| 9 | Case acceptance rate metric | #7 | Small | Not started |
| 10 | Connect activities to attendee rows | Nothing (can parallel) | Medium | Not started |
| 11 | Retire doctors table | #7 and #10 | Small | Not started |

Items 1-6b done. **Item 7 is next** — rebuild main dashboard to pull from data tables.

---

## What This Does NOT Cover (Future Consideration)

- Mentorship track splitting (beginner vs. advanced) — this is a program design decision, not a platform feature
- Financial conversation module / scripts — content, not code
- Billing code reference guide — could be a simple doc or a platform feature later
- Sure Smile content — curriculum gap, not platform
- Experience-level auto-tagging based on case count — could be added after #3 and #4 are done
