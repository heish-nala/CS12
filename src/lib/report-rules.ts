/**
 * CS12 Report Generation Rules
 *
 * Single source of truth for all rules that govern AI-generated report content.
 * These rules are injected into both the generation prompt AND the validation pass.
 * To add or change a rule: edit this file only.
 */

/**
 * Rules injected into the generation prompt so Claude follows them while writing.
 */
export const GENERATION_RULES = `
REPORT GENERATION RULES — follow all of these without exception:

1. ENROLLED DOCTORS ONLY
   Only name doctors from the DOCTOR ROSTER in any part of the report.
   Do not name any doctor not on the roster, even if their name appears in activity notes.
   A doctor from a different cohort or DSO must never appear in this report.

2. CLIENT-APPROPRIATE CONTENT
   This report goes to a DSO account executive (e.g. Chris Ambrose at Align Technology).
   EXCLUDE from all narrative sections:
   - Where a doctor lives or is based (city, country, region)
   - Illness, medical recovery, or health-related absences
   - Personal travel or family situations
   - Internal program-management context not relevant to clinical performance
   INCLUDE only: clinical performance data, pipeline status, program engagement
   observations, and specific barriers to case submission.

3. ATTRIBUTION — NO INVENTION
   Every specific claim about a doctor (blocker, quote, platform, person mentioned)
   must come directly from that doctor's entry in FULL ACTIVITY NOTES.
   Do not invent blockers, quotes, or situations not present in the notes.
   If a doctor has no activity notes, write a neutral observation based only on their stats.

4. EXACT DOCTOR NAMES
   Use the EXACT spelling of doctor names from the DOCTOR ROSTER as JSON keys.
   Do not shorten, reorder, or reformat names (e.g. "Dr. Smith" not "Smith").

5. STATS FROM DATA ONLY
   Only use the numbers provided in DOCTOR ROSTER and the summary stats.
   Do not estimate, infer, or derive stats from activity note text.

6. WRITING STYLE
   Direct, analytical, no filler sentences. Lead with what changed.
   Name the doctor, name the issue. No warm-up sentences.
   Do not use em dashes in prose. Use short sentences and plain punctuation.
`.trim();

/**
 * Rules given to the validator so it knows what to check.
 * Same substance as GENERATION_RULES but phrased as audit questions.
 */
export const VALIDATION_RULES = `
AUDIT RULES — check every rule below against the report narratives:

1. ENROLLED DOCTORS ONLY
   Are any doctor names present that are NOT in the enrolled roster?
   Flag every violation as: { rule: "enrolled-only", field: "fieldName", detail: "Dr. X is not enrolled" }

2. CLIENT-APPROPRIATE CONTENT
   Does any narrative mention where a doctor lives or is based, illness or medical
   recovery, personal travel, or family situations?
   Flag every violation as: { rule: "client-appropriate", field: "fieldName", detail: "mentions X" }

3. ATTRIBUTION — NO INVENTION
   Does any hot button, TM direction, or finding cite a specific blocker, quote, or
   person that does NOT appear in the activity notes for that doctor?
   Flag every violation as: { rule: "attribution", field: "fieldName", detail: "claims X not in notes" }

4. STATS ACCURACY
   Does any narrative state a number (cases, scans, Blueprint %) that contradicts
   the provided DOCTOR ROSTER stats?
   Flag every violation as: { rule: "stats", field: "fieldName", detail: "states X but data says Y" }

5. WRITING STYLE
   Does any field use em dashes (—) in prose?
   Flag as: { rule: "style", field: "fieldName", detail: "contains em dash" }
`.trim();
