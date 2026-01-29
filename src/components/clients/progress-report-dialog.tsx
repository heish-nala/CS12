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
import { cn } from '@/lib/utils';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

interface ProgressContact {
    id: string;
    rowId: string;
    tableId: string;
    name: string;
    email?: string;
    phone?: string;
    tableName: string;
    currentPeriodTotal?: number;
    currentPeriodLabel?: string;
    previousPeriodTotal?: number;
    metricsSummary?: Record<string, number>;
}

interface ProgressTable {
    id: string;
    name: string;
    time_tracking: {
        enabled: boolean;
        metrics: Array<{ id: string; name: string }>;
    } | null;
}

interface ProgressReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientName: string;
    tables: ProgressTable[];
    contacts: ProgressContact[];
}

export function ProgressReportDialog({
    open,
    onOpenChange,
    clientName,
    tables,
    contacts,
}: ProgressReportDialogProps) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [isGenerating, setIsGenerating] = useState(false);

    // Count contacts with current period data
    const contactsWithData = contacts.filter(c => c.currentPeriodLabel);

    const handleDownload = async () => {
        setIsGenerating(true);

        try {
            // Dynamic import to avoid SSR issues
            const { generateProgressReportPDF } = await import('@/lib/pdf-generator');

            await generateProgressReportPDF({
                clientName,
                tables,
                contacts,
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
                        Download Progress Report
                    </DialogTitle>
                    <DialogDescription>
                        Generate a PDF report of progress metrics for {clientName}.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
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

                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{contacts.length}</span>
                            {' '}contact{contacts.length !== 1 ? 's' : ''} across{' '}
                            <span className="font-medium text-foreground">{tables.length}</span>
                            {' '}table{tables.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Report will include metrics data for {MONTHS[selectedMonth]} {currentYear}.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDownload}
                        disabled={isGenerating || contacts.length === 0}
                    >
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
