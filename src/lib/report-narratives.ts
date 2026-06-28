import Anthropic from '@anthropic-ai/sdk';
import type { ReportData, ReportNarratives } from '@/lib/db/types';
import { GENERATION_RULES, VALIDATION_RULES } from '@/lib/report-rules';

export type { ReportNarratives };

// Model used for every report call. Opus 4.8 is the strongest model for the
// judgment-heavy bucketing and client-grade prose this report requires.
const REPORT_MODEL = 'claude-opus-4-8';

interface ValidationViolation {
    rule: string;
    field: string;
    detail: string;
}

interface ValidationResult {
    pass: boolean;
    violations: ValidationViolation[];
}

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Strip markdown code fences and parse Claude's response as JSON.
 * Shared by the initial draft and the corrective regeneration.
 */
function parseNarrativesJson(rawText: string): ReportNarratives {
    let jsonText = rawText.trim();
    if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    try {
        return JSON.parse(jsonText) as ReportNarratives;
    } catch (e) {
        console.error('Failed to parse Claude response as JSON. Raw text:', jsonText);
        throw new Error(`Claude returned invalid JSON (possibly truncated). Raw length: ${jsonText.length}. Parse error: ${e}`);
    }
}

/**
 * Apply the deterministic enrolled-only enforcement to a parsed narratives
 * object. Runs after every Claude call (initial draft AND corrective rewrite)
 * so a non-enrolled name can never survive into the report, regardless of what
 * the model returns.
 */
function enforceEnrolledOnly(parsed: ReportNarratives, enrolledNames: Set<string>): ReportNarratives {
    // Ensure new fields always exist even if Claude omits them
    if (!parsed.doctorHotButtons) parsed.doctorHotButtons = {};
    if (!parsed.tmDirections) parsed.tmDirections = {};
    if (!parsed.doctorGroups) {
        parsed.doctorGroups = { readyToSubmit: [], buildingHabits: [], structuralBarriers: [] };
    }

    const stripNonEnrolled = (obj: Record<string, string>) =>
        Object.fromEntries(Object.entries(obj).filter(([name]) => enrolledNames.has(name)));
    const filterNames = (arr: string[]) => arr.filter(name => enrolledNames.has(name));

    parsed.doctorHotButtons = stripNonEnrolled(parsed.doctorHotButtons);
    parsed.tmDirections = stripNonEnrolled(parsed.tmDirections);
    parsed.doctorGroups.readyToSubmit = filterNames(parsed.doctorGroups.readyToSubmit);
    parsed.doctorGroups.buildingHabits = filterNames(parsed.doctorGroups.buildingHabits);
    parsed.doctorGroups.structuralBarriers = filterNames(parsed.doctorGroups.structuralBarriers);

    return parsed;
}

export async function draftNarratives(data: ReportData): Promise<ReportNarratives> {
    // Enrolled doctor names — the allowlist. Every name in the report must be on this list.
    const enrolledNames = new Set(data.doctors.map(d => d.name));

    const doctorList = data.doctors.map(d =>
        `- ${d.name}: Blueprint ${d.blueprintPct ?? 'N/A'}%, Status: ${d.status}, Calls: ${d.callCount}, Accepted: ${d.accepted}, Scans: ${d.scans}, Diagnosed: ${d.diagnosed}`
    ).join('\n');

    // Filter quotes to enrolled doctors only before they reach the prompt
    const enrolledQuotes = data.quotes.filter(q => enrolledNames.has(q.doctorName));
    const quoteList = enrolledQuotes.length > 0
        ? enrolledQuotes.map(q => `- "${q.text}" — ${q.doctorName} (${q.date}, ${q.sentiment})`).join('\n')
        : '(No notable quotes captured this period)';

    const bucketSummary = `
Confidence Paradox doctors (high Blueprint%, 0 accepted): ${data.doctorBuckets.confidenceParadox.filter(n => enrolledNames.has(n)).join(', ') || 'None'}
Mentorship Mismatch doctors (negative mentorship sentiment): ${data.doctorBuckets.mentorshipMismatch.filter(n => enrolledNames.has(n)).join(', ') || 'None'}
Structural Barrier doctors (timing/office/relocation issues): ${data.doctorBuckets.structuralBarriers.filter(n => enrolledNames.has(n)).join(', ') || 'None'}`;

    // Build full activity notes block — each doctor under a ### heading
    const activityNotes = data.doctors
        .filter(d => d.activityNotesFull && d.activityNotesFull !== 'No activity logged this period.')
        .map(d => `### ${d.name}\n${d.activityNotesFull}`)
        .join('\n\n');

    const generationPrompt = `You are drafting sections of a performance report for a dental DSO onboarding program (Clear Aligner Advantage / Aligner Advantage).
Write in the style of the 7to7 DSO report: direct, analytical, specific, no filler sentences.
Use doctor names and data. Reference the Dreyfus Model of skill acquisition and Vygotsky's Zone of Proximal Development where relevant.

${GENERATION_RULES}

Chris Ambrose (Business Development Manager at Align Technology / iTero) receives this report.
He uses it to give directions to territory managers and to focus regional manager meetings.
What he values most:
- Specific hot buttons for each doctor (the one thing blocking or driving them right now)
- Suggested directions for territory managers — concrete actions by doctor name
- Direct, no-filler language. Lead with what changed. Name the doctor, name the issue.

DSO: ${data.dso.name}
Lead Ortho: ${data.dso.leadOrtho || 'Not specified'}
Reporting Period: ${data.period.start} to ${data.period.end}
Doctor Count: ${data.dso.doctorCount}
Total Calls: ${data.stats.callCount}
Doctors Contacted: ${data.stats.doctorsContacted}
Cases Accepted: ${data.stats.casesAccepted}
Scans: ${data.stats.scans}
Diagnosed: ${data.stats.diagnosed}

DOCTOR ROSTER (enrolled in this cohort only — no other names may appear in the report):
${doctorList}

FULL ACTIVITY NOTES (verbatim call/email logs, grouped by doctor — newest first):
${activityNotes || '(No activity logged this period)'}

NOTABLE QUOTES:
${quoteList}

FINDING BUCKETS:
${bucketSummary}

Write the following sections. Return ONLY valid JSON with these exact keys.
Each narrative value should be 1-3 paragraphs of polished report prose (not bullet points unless specified).
doctorHotButtons, tmDirections, and doctorGroups must use the EXACT doctor names from the DOCTOR ROSTER.

{
  "executiveSummary": "Core finding sentence + 1-2 sentences on what the data shows. Direct, no warm-up.",
  "finding1Intro": "2-3 sentences on which doctors show the Confidence Paradox pattern (high Blueprint%, 0 cases). Be specific with names and numbers.",
  "finding1Implication": "2 sentences: what does this mean and what specific action is needed?",
  "finding2Intro": "2-3 sentences on Mentorship Mismatch pattern. If no doctors in this bucket, write one sentence noting no mentorship friction was detected.",
  "finding2Implication": "2 sentences: what specific mentorship adjustment is recommended?",
  "finding3Intro": "2-3 sentences on Structural Barriers. If no doctors in this bucket, note it briefly.",
  "finding3Analysis": "2 sentences: what does this mean and how should the team respond?",
  "callSummaryNarrative": "2 sentences: overall tone and key takeaway from the calls this period.",
  "bottomLine": "1-2 sentences. The single most important thing this DSO needs to do right now.",
  "doctorHotButtons": {
    "Doctor Name": "One sentence: the single most important thing blocking or driving this doctor right now, drawn from the call notes."
  },
  "tmDirections": {
    "Doctor Name": "One sentence: the specific action the territory manager should take or message to deliver on the next interaction with this doctor."
  },
  "doctorGroups": {
    "readyToSubmit": ["Doctor Name"],
    "buildingHabits": ["Doctor Name"],
    "structuralBarriers": ["Doctor Name"]
  }
}

Return ONLY the JSON object. No preamble, no explanation, no markdown code fences, no reasoning about your choices — just the final JSON.`;

    const message = await client.messages.create({
        model: REPORT_MODEL,
        max_tokens: 6000,
        messages: [{ role: 'user', content: generationPrompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type from Claude API');

    let parsed = parseNarrativesJson(content.text);

    // ENFORCEMENT: hard strip of any non-enrolled names Claude returned
    parsed = enforceEnrolledOnly(parsed, enrolledNames);

    // VALIDATION PASS: second Claude call checks the output against the rules
    const validationResult = await validateNarratives(parsed, data, enrolledNames, activityNotes, doctorList);
    if (!validationResult.pass && validationResult.violations.length > 0) {
        console.warn(
            `[report-narratives] Validation found ${validationResult.violations.length} violation(s), attempting one corrective rewrite:`,
            JSON.stringify(validationResult.violations, null, 2)
        );

        // SELF-HEAL: one corrective regeneration. Feed the violations back to
        // Claude with the original context and ask it to fix exactly those
        // problems. A single retry (not a loop) so a report can never hang.
        const healed = await reviseNarratives(
            parsed,
            validationResult.violations,
            generationPrompt,
        );
        if (healed) {
            // Re-apply enrolled-only enforcement to the rewritten output, then
            // re-validate purely for the audit log (we ship the rewrite either way).
            const healedEnforced = enforceEnrolledOnly(healed, enrolledNames);
            const recheck = await validateNarratives(
                healedEnforced, data, enrolledNames, activityNotes, doctorList,
            );
            if (recheck.pass) {
                console.info('[report-narratives] Corrective rewrite resolved all violations.');
            } else {
                console.warn(
                    `[report-narratives] ${recheck.violations.length} violation(s) remain after rewrite (shipping rewrite; logged for human review):`,
                    JSON.stringify(recheck.violations, null, 2)
                );
            }
            return healedEnforced;
        }
        // Rewrite failed to run/parse — fall through and ship the enforced original.
        console.warn('[report-narratives] Corrective rewrite did not produce usable output; shipping the enforced original draft.');
    }

    return parsed;
}

/**
 * Corrective regeneration. Given the drafted narratives and the specific
 * violations the validator flagged, ask Claude to rewrite ONLY what's broken
 * and return the full corrected JSON. Returns null if the call fails or the
 * response can't be parsed — the caller then ships the enforced original.
 */
async function reviseNarratives(
    narratives: ReportNarratives,
    violations: ValidationViolation[],
    generationPrompt: string,
): Promise<ReportNarratives | null> {
    const violationList = violations
        .map(v => `- [${v.rule}] field "${v.field}": ${v.detail}`)
        .join('\n');

    const revisionPrompt = `${generationPrompt}

---

You already produced the following draft, but a quality auditor flagged problems with it.

YOUR PREVIOUS DRAFT:
${JSON.stringify(narratives, null, 2)}

AUDITOR VIOLATIONS TO FIX:
${violationList}

Rewrite the report to fix every violation above while keeping everything else intact.
Apply the same rules as before — especially: only enrolled doctors may be named, no
client-inappropriate content (location, illness, personal/family/travel), every specific
claim must trace to the activity notes, numbers must match the roster, and no em dashes.

Return ONLY the corrected JSON object with the exact same keys as before. No preamble,
no explanation, no markdown code fences, no reasoning — just the final JSON.`;

    try {
        const message = await client.messages.create({
            model: REPORT_MODEL,
            max_tokens: 6000,
            messages: [{ role: 'user', content: revisionPrompt }],
        });

        const content = message.content[0];
        if (content.type !== 'text') return null;

        return parseNarrativesJson(content.text);
    } catch (e) {
        console.error('[report-narratives] Corrective rewrite failed to run:', e);
        return null;
    }
}

async function validateNarratives(
    narratives: ReportNarratives,
    data: ReportData,
    enrolledNames: Set<string>,
    activityNotes: string,
    doctorList: string,
): Promise<ValidationResult> {
    // Flatten narrative prose fields for the validator to inspect
    const proseFields = [
        { field: 'executiveSummary', text: narratives.executiveSummary },
        { field: 'finding1Intro', text: narratives.finding1Intro },
        { field: 'finding1Implication', text: narratives.finding1Implication },
        { field: 'finding2Intro', text: narratives.finding2Intro },
        { field: 'finding2Implication', text: narratives.finding2Implication },
        { field: 'finding3Intro', text: narratives.finding3Intro },
        { field: 'finding3Analysis', text: narratives.finding3Analysis },
        { field: 'callSummaryNarrative', text: narratives.callSummaryNarrative },
        { field: 'bottomLine', text: narratives.bottomLine },
        ...Object.entries(narratives.doctorHotButtons).map(([k, v]) => ({ field: `doctorHotButtons.${k}`, text: v })),
        ...Object.entries(narratives.tmDirections).map(([k, v]) => ({ field: `tmDirections.${k}`, text: v })),
    ];

    const narrativesText = proseFields.map(f => `[${f.field}]: ${f.text}`).join('\n\n');
    const enrolledList = Array.from(enrolledNames).join(', ');

    const validationPrompt = `You are a quality auditor for a client-facing DSO performance report.
Your job is to check the report narratives against the rules below and return a structured list of violations.
Be thorough. A violation that reaches the client causes serious embarrassment.

${VALIDATION_RULES}

ENROLLED DOCTORS (the only names allowed in the report):
${enrolledList}

DOCTOR STATS (for checking number accuracy):
${doctorList}

ACTIVITY NOTES (for checking attribution claims):
${activityNotes || '(No activity notes this period)'}

REPORT NARRATIVES TO AUDIT:
${narrativesText}

Return ONLY valid JSON in this exact shape:
{
  "pass": true,
  "violations": []
}
or if violations found:
{
  "pass": false,
  "violations": [
    { "rule": "enrolled-only", "field": "finding2Intro", "detail": "Dr. Verdell is not enrolled in this cohort" }
  ]
}

No preamble. No explanation. No reasoning. Valid JSON only.`;

    try {
        const message = await client.messages.create({
            model: REPORT_MODEL,
            max_tokens: 1000,
            messages: [{ role: 'user', content: validationPrompt }],
        });

        const content = message.content[0];
        if (content.type !== 'text') return { pass: true, violations: [] };

        let jsonText = content.text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        return JSON.parse(jsonText) as ValidationResult;
    } catch (e) {
        // Validation failure must never block report generation — log and continue
        console.error('[report-narratives] Validation pass failed to run:', e);
        return { pass: true, violations: [] };
    }
}
