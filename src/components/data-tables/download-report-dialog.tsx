'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Download, FileText, Loader2, Check } from 'lucide-react';
import { DataColumn, DataRow, PeriodData, TimeTrackingConfig } from '@/lib/db/types';
import { cn } from '@/lib/utils';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

interface DownloadReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tableName: string;
    columns: DataColumn[];
    rows: DataRow[];
    timeTracking: TimeTrackingConfig | null;
    periodData: Record<string, PeriodData[]>;
}

export function DownloadReportDialog({
    open,
    onOpenChange,
    tableName,
    columns,
    rows,
    timeTracking,
    periodData,
}: DownloadReportDialogProps) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        setIsGenerating(true);

        try {
            // Dynamic import to avoid SSR issues
            const { generateAttendeeTrackerPDF } = await import('@/lib/pdf-generator');

            await generateAttendeeTrackerPDF({
                tableName,
                columns,
                rows,
                timeTracking,
                periodData,
                selectedMonth,
                year: currentYear,
            });

            onOpenChange(false);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Download Report
                    </DialogTitle>
                    <DialogDescription>
                        Select a month to generate your {tableName} report.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4 pt-4">
                    <Label className="text-sm font-medium mb-3 block">
                        Select Month
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                        {MONTHS.map((month, index) => (
                            <button
                                key={month}
                                onClick={() => setSelectedMonth(index)}
                                className={cn(
                                    "flex items-center justify-center px-3 py-2 text-sm border rounded-md transition-colors",
                                    selectedMonth === index
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "hover:bg-muted border-input"
                                )}
                            >
                                {month.slice(0, 3)}
                                {selectedMonth === index && (
                                    <Check className="h-3 w-3 ml-1" />
                                )}
                            </button>
                        ))}
                    </div>

                    <p className="text-xs text-muted-foreground mt-3">
                        Report will include all attendee data for {MONTHS[selectedMonth]} {currentYear}
                    </p>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleDownload} disabled={isGenerating}>
                        {isGenerating ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
