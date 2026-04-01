'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Download, Loader2, FileText, Sparkles } from 'lucide-react';
import type { ReportData, ReportNarratives } from '@/lib/db/types';

interface ReportPageProps {
    params: Promise<{ id: string }>;
}

function formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default function ReportPage({ params }: ReportPageProps) {
    const { id } = use(params);
    const router = useRouter();

    // Date range state
    const [periodStart, setPeriodStart] = useState(() => {
        const today = new Date();
        return formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
    });
    const [periodEnd, setPeriodEnd] = useState(() => formatDateInput(new Date()));

    // Report generation state
    const [loading, setLoading] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<ReportData | null>(null);

    // Editable narrative fields
    const [editedNarratives, setEditedNarratives] = useState<ReportNarratives | null>(null);

    const handleGenerateReport = async () => {
        setLoading(true);
        setError(null);
        setReportData(null);
        setEditedNarratives(null);

        try {
            const res = await fetch(`/api/report/generate-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: id, periodStart, periodEnd }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to generate report data');
            }

            const { reportData: rd, narratives: n } = await res.json();
            setReportData(rd);
            setEditedNarratives(n);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const updateNarrative = (key: keyof ReportNarratives, value: string) => {
        setEditedNarratives(prev => prev ? { ...prev, [key]: value } : prev);
    };

    const handleDownloadPdf = async () => {
        if (!reportData || !editedNarratives) return;
        setLoadingPdf(true);
        try {
            const res = await fetch('/api/report/export-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportData, narratives: editedNarratives }),
            });

            if (!res.ok) {
                const errText = await res.text();
                let errMsg = 'PDF export failed';
                try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
                throw new Error(errMsg);
            }

            // Returns filled HTML — open in a new tab so user can print to PDF
            const html = await res.text();
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const win = window.open(url, '_blank');
            // Auto-trigger print dialog after load
            if (win) {
                win.addEventListener('load', () => {
                    win.focus();
                    win.print();
                });
            } else {
                setError('Popup blocked. Please allow popups for this site and try again.');
            }
            // Revoke after a delay to allow the tab to load
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'PDF download failed');
        } finally {
            setLoadingPdf(false);
        }
    };

    return (
        <div className="flex-1 bg-background min-h-screen">
            {/* Header */}
            <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                <div className="px-6 lg:px-8 pt-8 pb-6">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex items-center gap-3 mb-4">
                            <Button variant="ghost" size="sm" onClick={() => router.back()}>
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </Button>
                        </div>
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-semibold tracking-tight">Performance Report</h1>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Auto-generate a CAA-style report from CS12 data
                                    </p>
                                </div>
                            </div>
                            {reportData && editedNarratives && (
                                <Button onClick={handleDownloadPdf} disabled={loadingPdf}>
                                    {loadingPdf ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating PDF…</>
                                    ) : (
                                        <><Download className="h-4 w-4 mr-2" />Download PDF</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 lg:px-8 py-6">
                <div className="max-w-5xl mx-auto space-y-8">

                    {/* Date Range + Generate */}
                    <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
                        <h2 className="text-base font-semibold">Reporting Period</h2>
                        <div className="flex items-end gap-4">
                            <div className="space-y-1.5">
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    value={periodStart}
                                    onChange={e => setPeriodStart(e.target.value)}
                                    className="w-44"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={periodEnd}
                                    onChange={e => setPeriodEnd(e.target.value)}
                                    className="w-44"
                                />
                            </div>
                            <Button onClick={handleGenerateReport} disabled={loading} className="mb-0">
                                {loading ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
                                ) : (
                                    <><Sparkles className="h-4 w-4 mr-2" />Generate Report</>
                                )}
                            </Button>
                        </div>
                        {loading && (
                            <p className="text-sm text-muted-foreground">
                                Pulling data and drafting narratives with Claude… this takes ~30 seconds.
                            </p>
                        )}
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Report Preview */}
                    {reportData && editedNarratives && (
                        <>
                            {/* Stats Summary */}
                            <div className="rounded-xl border border-border/50 bg-card p-6">
                                <h2 className="text-base font-semibold mb-4">Report Stats — {reportData.dso.name}</h2>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <StatCard label="Enrolled Doctors" value={reportData.dso.doctorCount} />
                                    <StatCard label="Calls Made" value={reportData.stats.callCount} />
                                    <StatCard label="Doctors Contacted" value={reportData.stats.doctorsContacted} />
                                    <StatCard label="Cases Accepted" value={reportData.stats.casesAccepted} />
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                                    <StatCard label="Scans" value={reportData.stats.scans} />
                                    <StatCard label="Diagnosed" value={reportData.stats.diagnosed} />
                                    <StatCard label="Lead Ortho" value={reportData.dso.leadOrtho || 'Not set'} text />
                                </div>
                            </div>

                            {/* Doctor Table */}
                            <div className="rounded-xl border border-border/50 bg-card p-6">
                                <h2 className="text-base font-semibold mb-4">Doctor Roster</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border/50">
                                                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Doctor</th>
                                                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Blueprint</th>
                                                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Calls</th>
                                                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Accepted</th>
                                                <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportData.doctors.map(d => (
                                                <tr key={d.name} className="border-b border-border/30 last:border-0">
                                                    <td className="py-2 pr-4 font-medium">{d.name}</td>
                                                    <td className="py-2 pr-4">
                                                        {d.blueprintPct !== null ? (
                                                            <span className={
                                                                d.blueprintPct >= 80 ? 'text-green-700 font-semibold' :
                                                                d.blueprintPct >= 50 ? 'text-orange-600 font-semibold' :
                                                                'text-red-600 font-semibold'
                                                            }>{d.blueprintPct}%</span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="py-2 pr-4">{d.callCount}</td>
                                                    <td className="py-2 pr-4">{d.accepted}</td>
                                                    <td className="py-2">
                                                        <span className="text-xs bg-muted px-2 py-0.5 rounded">{d.status || '—'}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Finding Buckets */}
                            <div className="rounded-xl border border-border/50 bg-card p-6">
                                <h2 className="text-base font-semibold mb-4">Doctor Classification</h2>
                                <div className="space-y-3 text-sm">
                                    <div className="flex gap-2">
                                        <span className="font-medium w-52 shrink-0 text-blue-700">Confidence Paradox:</span>
                                        <span>{reportData.doctorBuckets.confidenceParadox.join(', ') || 'None'}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-medium w-52 shrink-0 text-orange-700">Mentorship Mismatch:</span>
                                        <span>{reportData.doctorBuckets.mentorshipMismatch.join(', ') || 'None'}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-medium w-52 shrink-0 text-red-700">Structural Barriers:</span>
                                        <span>{reportData.doctorBuckets.structuralBarriers.join(', ') || 'None'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Editable Narratives */}
                            <div className="rounded-xl border border-border/50 bg-card p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-semibold">AI-Drafted Narratives</h2>
                                    <p className="text-xs text-muted-foreground">Edit any section before downloading</p>
                                </div>

                                <NarrativeField
                                    label="Executive Summary"
                                    field="executiveSummary"
                                    value={editedNarratives.executiveSummary}
                                    onChange={updateNarrative}
                                />
                                <NarrativeField
                                    label="Finding #1 — Confidence Paradox (Intro)"
                                    field="finding1Intro"
                                    value={editedNarratives.finding1Intro}
                                    onChange={updateNarrative}
                                />
                                <NarrativeField
                                    label="Finding #1 — Implication"
                                    field="finding1Implication"
                                    value={editedNarratives.finding1Implication}
                                    onChange={updateNarrative}
                                />
                                <NarrativeField
                                    label="Finding #2 — Mentorship Mismatch (Intro)"
                                    field="finding2Intro"
                                    value={editedNarratives.finding2Intro}
                                    onChange={updateNarrative}
                                />
                                <NarrativeField
                                    label="Finding #2 — Implication"
                                    field="finding2Implication"
                                    value={editedNarratives.finding2Implication}
                                    onChange={updateNarrative}
                                />
                                <NarrativeField
                                    label="Finding #3 — Structural Barriers (Intro)"
                                    field="finding3Intro"
                                    value={editedNarratives.finding3Intro}
                                    onChange={updateNarrative}
                                />
                                <NarrativeField
                                    label="Finding #3 — Analysis"
                                    field="finding3Analysis"
                                    value={editedNarratives.finding3Analysis}
                                    onChange={updateNarrative}
                                />
                                <NarrativeField
                                    label="Call Summary Narrative"
                                    field="callSummaryNarrative"
                                    value={editedNarratives.callSummaryNarrative}
                                    onChange={updateNarrative}
                                />
                                <NarrativeField
                                    label="Next Steps"
                                    field="nextSteps"
                                    value={editedNarratives.nextSteps}
                                    onChange={updateNarrative}
                                    rows={6}
                                />
                                <NarrativeField
                                    label="Bottom Line"
                                    field="bottomLine"
                                    value={editedNarratives.bottomLine}
                                    onChange={updateNarrative}
                                />
                            </div>

                            {/* Quotes */}
                            {reportData.quotes.length > 0 && (
                                <div className="rounded-xl border border-border/50 bg-card p-6">
                                    <h2 className="text-base font-semibold mb-4">Notable Quotes ({reportData.quotes.length})</h2>
                                    <div className="space-y-3">
                                        {reportData.quotes.map((q, i) => (
                                            <blockquote key={i} className="border-l-4 border-amber-300 bg-amber-50 pl-4 py-3 pr-4 rounded-r-lg">
                                                <p className="text-sm italic text-gray-800">"{q.text}"</p>
                                                <footer className="text-xs text-gray-500 mt-1">
                                                    — {q.doctorName} · {q.date}
                                                </footer>
                                            </blockquote>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Download CTA */}
                            <div className="flex justify-end pb-8">
                                <Button size="lg" onClick={handleDownloadPdf} disabled={loadingPdf}>
                                    {loadingPdf ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating PDF…</>
                                    ) : (
                                        <><Download className="h-4 w-4 mr-2" />Download PDF</>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, text }: { label: string; value: number | string; text?: boolean }) {
    return (
        <div className="rounded-lg border border-border/50 p-4 text-center">
            <div className={`font-bold text-2xl ${text ? 'text-base font-semibold' : 'text-blue-600'}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wide font-medium">{label}</div>
        </div>
    );
}

function NarrativeField({
    label,
    field,
    value,
    onChange,
    rows = 4,
}: {
    label: string;
    field: keyof ReportNarratives;
    value: string;
    onChange: (field: keyof ReportNarratives, value: string) => void;
    rows?: number;
}) {
    return (
        <div className="space-y-2">
            <Label className="text-sm font-medium">{label}</Label>
            <Textarea
                value={value}
                onChange={e => onChange(field, e.target.value)}
                rows={rows}
                className="text-sm leading-relaxed resize-y"
            />
        </div>
    );
}
