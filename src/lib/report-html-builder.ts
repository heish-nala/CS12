import fs from 'fs';
import path from 'path';
import type { ReportData, ReportNarratives } from '@/lib/db/types';

/**
 * Build the filled HTML for a performance report.
 * Reads the template from /public/report-template.html and substitutes all placeholders.
 */
export function buildReportHtml(data: ReportData, narratives: ReportNarratives): string {
    const templatePath = path.join(process.cwd(), 'public', 'report-template.html');
    let html = fs.readFileSync(templatePath, 'utf-8');

    // ── Simple placeholder replacements ──────────────────────────────────────
    const formatDate = (iso: string) => {
        const d = new Date(iso + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };
    const leadOrtho = data.dso.leadOrtho || 'Lead Ortho';

    html = replaceAll(html, '[DOCTOR_COUNT]', String(data.dso.doctorCount));
    html = replaceAll(html, '[PERIOD_START]', formatDate(data.period.start));
    html = replaceAll(html, '[PERIOD_END]', formatDate(data.period.end));
    html = replaceAll(html, '[REPORT_DATE]', data.period.reportDate);
    html = replaceAll(html, '[CALL_COUNT]', String(data.stats.callCount));
    html = replaceAll(html, '[DOCTORS_REACHED]', String(data.stats.doctorsContacted));
    html = replaceAll(html, '[DOCTORS_REACHED_TEXT]', `${data.stats.doctorsContacted} of ${data.dso.doctorCount} enrolled doctors`);
    html = replaceAll(html, '[CASES_ACCEPTED]', String(data.stats.casesAccepted));
    html = replaceAll(html, '[LEAD_ORTHO]', leadOrtho);

    // ── Narrative replacements ────────────────────────────────────────────────
    html = html.replace(
        '[EXECUTIVE_SUMMARY_NARRATIVE — 2–3 sentences summarizing overall progress, key wins, and primary focus area for this DSO.]',
        narratives.executiveSummary,
    );
    html = html.replace(
        '[FINDING_1_INTRO — Which doctors in this DSO show this pattern, and what does it look like for them specifically?]',
        narratives.finding1Intro,
    );
    html = html.replace(
        "[FINDING_1_IMPLICATION — What's the specific action this DSO needs to move these doctors through the confidence dip?]",
        narratives.finding1Implication,
    );
    html = html.replace(
        '[FINDING_2_INTRO — How many doctors in this DSO reported this issue, and what specifically did they describe?]',
        narratives.finding2Intro,
    );
    html = html.replace(
        '[FINDING_2_IMPLICATION — What specific mentorship adjustment is recommended for this DSO?]',
        narratives.finding2Implication,
    );
    html = html.replace(
        '[FINDING_3_INTRO — Which doctors in this DSO face external/structural barriers rather than motivation or confidence issues?]',
        narratives.finding3Intro,
    );
    html = html.replace(
        '[BARRIER_ANALYSIS — Why is this a structural issue rather than a motivation issue, and what\'s the right response?]',
        narratives.finding3Analysis,
    );
    html = html.replace(
        '[CALLS_INSIGHT — NOTE: Do NOT repeat the confidence/mentorship findings from pages 3–4. Focus on call engagement outcomes: who engaged openly, overall retention signal, and the 1–2 concrete fixes that keep surfacing across all conversations.]',
        narratives.callSummaryNarrative,
    );
    html = html.replace(
        '[BOTTOM_LINE — 2–3 sentences. What is the single most important thing this DSO needs right now, and why will it have the biggest impact?]',
        narratives.bottomLine,
    );

    // Call summary with narrative embedded
    html = html.replace(
        `[CALL_SUMMARY_NARRATIVE — 2 sentences on the overall tone and key takeaway from the calls.]`,
        narratives.callSummaryNarrative,
    );

    // ── Doctor table ─────────────────────────────────────────────────────────
    const doctorRows = data.doctors.map(d => {
        const bpClass = d.blueprintPct === null ? '' :
            d.blueprintPct >= 80 ? 'bp-green' :
            d.blueprintPct >= 50 ? 'bp-orange' : 'bp-red';
        const bp = d.blueprintPct !== null ? `${d.blueprintPct}%` : '—';
        return `<tr>
  <td><strong>${escHtml(d.name)}</strong></td>
  <td class="${bpClass}">${bp}</td>
  <td>${d.callCount}</td>
  <td>${escHtml(d.priorActivity)}</td>
  <td>${escHtml(d.currentActivity)}</td>
</tr>`;
    }).join('\n');

    // Replace the placeholder table body
    html = html.replace(
        /<tbody>\s*<!-- Row example:[\s\S]*?-->\s*<tr>\s*<td colspan="5"[^>]*>[^<]*<\/td>\s*<\/tr>\s*<\/tbody>/,
        `<tbody>\n${doctorRows}\n</tbody>`,
    );

    // ── Quotes ────────────────────────────────────────────────────────────────
    // Replace the two fixed quote placeholders with actual quotes (or empty if none)
    const q1 = data.quotes[0];
    const q2 = data.quotes[1];
    const q3 = data.quotes[2];

    html = html.replace(
        `<p>"[DOCTOR_QUOTE_1]"</p>\n    <div class="quote-attr">— [DOCTOR_NAME] ([DSO_NAME]) &bull; [QUOTE_SOURCE]</div>`,
        q1
            ? `<p>"${escHtml(q1.text)}"</p>\n    <div class="quote-attr">— ${escHtml(q1.doctorName)} (${escHtml(data.dso.name)}) &bull; ${q1.date}</div>`
            : `<p><em>No quotes captured this period.</em></p>\n    <div class="quote-attr"></div>`,
    );
    html = html.replace(
        `<p>"[DOCTOR_QUOTE_2]"</p>\n    <div class="quote-attr">— [DOCTOR_NAME] ([DSO_NAME]) &bull; [QUOTE_SOURCE]</div>`,
        q2
            ? `<p>"${escHtml(q2.text)}"</p>\n    <div class="quote-attr">— ${escHtml(q2.doctorName)} (${escHtml(data.dso.name)}) &bull; ${q2.date}</div>`
            : `<p><em>No quotes captured this period.</em></p>\n    <div class="quote-attr"></div>`,
    );

    // Finding 2 quote
    html = html.replace(
        `<p>"[DOCTOR_QUOTE]"</p>\n    <div class="quote-attr">— [DOCTOR_NAME] ([DSO_NAME])</div>`,
        q3
            ? `<p>"${escHtml(q3.text)}"</p>\n    <div class="quote-attr">— ${escHtml(q3.doctorName)} (${escHtml(data.dso.name)})</div>`
            : `<p><em>No quotes captured this period.</em></p>\n    <div class="quote-attr"></div>`,
    );

    // Finding 3 quote
    const structuralQuote = data.quotes.find(q =>
        data.doctorBuckets.structuralBarriers.includes(q.doctorName)
    );
    html = html.replace(
        `<p>"[DOCTOR_QUOTE]"</p>\n    <div class="quote-attr">— [DOCTOR_NAME] ([DSO_NAME]) &bull; [CALL_DATE]</div>`,
        structuralQuote
            ? `<p>"${escHtml(structuralQuote.text)}"</p>\n    <div class="quote-attr">— ${escHtml(structuralQuote.doctorName)} (${escHtml(data.dso.name)}) &bull; ${structuralQuote.date}</div>`
            : `<p><em>No quotes captured this period.</em></p>\n    <div class="quote-attr"></div>`,
    );

    // ── Finding 3 structural barrier section ─────────────────────────────────
    const structuralDoctors = data.doctorBuckets.structuralBarriers;
    if (structuralDoctors.length > 0) {
        html = html.replace(
            '[BARRIER_TYPE] — [DOCTOR_NAME]',
            `Structural Barrier — ${structuralDoctors.join(', ')}`,
        );
        html = html.replace(
            '[BARRIER_DESCRIPTION — What is the specific operational barrier this doctor faces?]',
            narratives.finding3Analysis,
        );
    } else {
        html = html.replace('[BARRIER_TYPE] — [DOCTOR_NAME]', 'Structural Barriers');
        html = html.replace(
            '[BARRIER_DESCRIPTION — What is the specific operational barrier this doctor faces?]',
            'No structural barriers identified this period.',
        );
    }

    // ── Sentiment table ───────────────────────────────────────────────────────
    const sentimentRows = buildSentimentTableRows(data);
    html = html.replace(
        `<!-- SENTIMENT_TABLE_START -->\n    <tbody>\n      <!-- Add one row per program element mentioned in calls -->\n      <tr>\n        <td>Blueprint course content</td>\n        <td><span style="color:#2a8a3a;font-weight:600;">[SENTIMENT]</span></td>\n        <td>[DOCTORS_WHO_MENTIONED]</td>\n      </tr>\n      <tr>\n        <td>${leadOrtho}'s clinical walkthrough</td>\n        <td><span style="color:#2a8a3a;font-weight:600;">[SENTIMENT]</span></td>\n        <td>[DOCTORS_WHO_MENTIONED]</td>\n      </tr>\n      <tr>\n        <td>Buddy system</td>\n        <td><span style="color:#2a8a3a;font-weight:600;">[SENTIMENT]</span></td>\n        <td>[DOCTORS_WHO_MENTIONED]</td>\n      </tr>\n      <tr>\n        <td>Monthly mentorship calls</td>\n        <td><span style="color:#d45c00;font-weight:600;">[SENTIMENT]</span></td>\n        <td>[DOCTORS_WHO_MENTIONED]</td>\n      </tr>\n    </tbody>`,
        `<!-- SENTIMENT_TABLE_START -->\n    <tbody>\n${sentimentRows ? `${sentimentRows}\n` : ''}    </tbody>`,
    );

    // ── Next steps / per-doctor recommendations ───────────────────────────────
    html = html.replace(
        '[DOCTOR_NAME] — [ACTION_TITLE]',
        data.doctors.length > 0 ? `${data.doctors[0].name} — Priority Action` : 'Doctor — Priority Action',
    );
    html = html.replace(
        '[DOCTOR_SPECIFIC_RECOMMENDATION — What is the single most important next action for this doctor, and why will it move them forward?]',
        narratives.nextSteps,
    );
    html = html.replace(
        '[BEGINNER_SESSION_RECOMMENDATION — Which doctors need this, and what would the session focus on for this DSO\'s specific gaps?]',
        `Beginner-track session recommended for: ${data.doctorBuckets.confidenceParadox.join(', ') || 'TBD based on next assessment'}`,
    );

    // Barrier one-liners
    const barrierOneLiner = structuralDoctors.length > 0
        ? `${structuralDoctors.map(n => `<strong>${escHtml(n)}</strong> — structural barrier, monitor for resolution`).join('. ')}.`
        : 'No structural barriers identified this period.';
    html = html.replace(
        '<strong>[DOCTOR_NAME]</strong> — [BARRIER_ONE_LINER: status + next action]. <strong>[DOCTOR_NAME_2]</strong> — [BARRIER_ONE_LINER: status + next action].',
        barrierOneLiner,
    );

    // ── Sweep up any remaining obvious placeholders ───────────────────────────
    // These are section-level placeholders that are part of the template structure
    html = html.replace(/\[BARRIER_TYPE\]/g, 'Structural Barrier');
    html = html.replace(/\[DOCTOR_NAME\]/g, '');
    html = html.replace(/\[DOCTOR_NAME_2\]/g, '');
    html = html.replace(/\[QUOTE_SOURCE\]/g, '');
    html = html.replace(/\[CALL_DATE\]/g, '');
    html = html.replace(/\[DOCTORS_WHO_MENTIONED\]/g, '');
    html = html.replace(/\[SENTIMENT\]/g, '');
    html = html.replace(/\[BARRIER_DESCRIPTION[^\]]*\]/g, '');
    html = html.replace(/\[DOCTOR_SPECIFIC_RECOMMENDATION[^\]]*\]/g, '');
    html = html.replace(/\[BEGINNER_SESSION_RECOMMENDATION[^\]]*\]/g, '');
    html = html.replace(/\[ACTION_TITLE\]/g, '');
    html = replaceAll(html, '[DSO_NAME]', data.dso.name);
    html = html.replace(/\[[^\]]+\]/g, ''); // catch-all for any remaining [ ] placeholders

    return html;
}

function buildSentimentTableRows(data: ReportData): string {
    if (data.sentimentSummary.length === 0) return '';

    // Group by element and take first few
    const seen = new Set<string>();
    const rows: string[] = [];
    for (const s of data.sentimentSummary.slice(0, 8)) {
        if (seen.has(s.element)) continue;
        seen.add(s.element);
        const color = s.sentiment === 'positive' ? '#2a8a3a' :
            s.sentiment === 'negative' ? '#cc2222' : '#8899bb';
        rows.push(`<tr>
  <td>${escHtml(s.element)}</td>
  <td><span style="color:${color};font-weight:600;">${s.sentiment}</span></td>
  <td>${escHtml(s.whoSaidIt)}</td>
</tr>`);
    }
    return rows.join('\n');
}

function replaceAll(str: string, search: string, replacement: string): string {
    return str.split(search).join(replacement);
}

function escHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
