import Anthropic from '@anthropic-ai/sdk';
import type { ReportData, ReportNarratives } from '@/lib/db/types';

export type { ReportNarratives };

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Draft narrative paragraphs for a performance report using Claude.
 * The output mimics the tone of the 7to7 report: direct, analytical, no filler.
 */
export async function draftNarratives(data: ReportData): Promise<ReportNarratives> {
    const doctorList = data.doctors.map(d =>
        `- ${d.name}: Blueprint ${d.blueprintPct ?? 'N/A'}%, Status: ${d.status}, Calls: ${d.callCount}, Accepted: ${d.accepted}, Scans: ${d.scans}, Diagnosed: ${d.diagnosed}`
    ).join('\n');

    const quoteList = data.quotes.length > 0
        ? data.quotes.map(q => `- "${q.text}" — ${q.doctorName} (${q.date}, ${q.sentiment})`).join('\n')
        : '(No notable quotes captured this period)';

    const bucketSummary = `
Confidence Paradox doctors (high Blueprint%, 0 accepted): ${data.doctorBuckets.confidenceParadox.join(', ') || 'None'}
Mentorship Mismatch doctors (negative mentorship sentiment): ${data.doctorBuckets.mentorshipMismatch.join(', ') || 'None'}
Structural Barrier doctors (timing/office/relocation issues): ${data.doctorBuckets.structuralBarriers.join(', ') || 'None'}`;

    const prompt = `You are drafting sections of a performance report for a dental DSO onboarding program.
Write in the style of the 7to7 DSO report: direct, analytical, specific, no filler sentences.
Use doctor names and data. Reference the Dreyfus Model of skill acquisition and Vygotsky's Zone of Proximal Development where relevant.
Never hallucinate names or stats — only use what is provided.

DSO: ${data.dso.name}
Lead Ortho: ${data.dso.leadOrtho || 'Not specified'}
Reporting Period: ${data.period.start} to ${data.period.end}
Doctor Count: ${data.dso.doctorCount}
Total Calls: ${data.stats.callCount}
Doctors Contacted: ${data.stats.doctorsContacted}
Cases Accepted: ${data.stats.casesAccepted}
Scans: ${data.stats.scans}
Diagnosed: ${data.stats.diagnosed}

DOCTOR ROSTER:
${doctorList}

NOTABLE QUOTES:
${quoteList}

FINDING BUCKETS:
${bucketSummary}

Write the following sections. Use JSON format with these exact keys.
Each value should be 1-3 paragraphs of polished report prose (not bullet points unless specified).

{
  "executiveSummary": "Core finding sentence + 1-2 sentences on what the data shows. Direct, no warm-up.",
  "finding1Intro": "2-3 sentences on which doctors show the Confidence Paradox pattern (high Blueprint%, 0 cases). Be specific with names and numbers.",
  "finding1Implication": "2 sentences: what does this mean and what specific action is needed?",
  "finding2Intro": "2-3 sentences on Mentorship Mismatch pattern. If no doctors in this bucket, write one sentence noting no mentorship friction was detected.",
  "finding2Implication": "2 sentences: what specific mentorship adjustment is recommended?",
  "finding3Intro": "2-3 sentences on Structural Barriers. If no doctors in this bucket, note it briefly.",
  "finding3Analysis": "2 sentences: what does this mean and how should the team respond?",
  "callSummaryNarrative": "2 sentences: overall tone and key takeaway from the calls this period.",
  "nextSteps": "3-5 specific, actionable next steps as a bulleted list. Use real doctor names where applicable.",
  "bottomLine": "1-2 sentences. The single most important thing this DSO needs to do right now."
}

Return ONLY valid JSON. No preamble, no explanation.`;

    const message = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type from Claude API');

    // Strip markdown code fences if present
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText) as ReportNarratives;
    return parsed;
}
