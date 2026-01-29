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
import { Activity } from '@/lib/db/types';
import { cn } from '@/lib/utils';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

interface ActivityReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientName: string;
    activities: Activity[];
}

export function ActivityReportDialog({
    open,
    onOpenChange,
    clientName,
    activities,
}: ActivityReportDialogProps) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [isGenerating, setIsGenerating] = useState(false);

    // Count activities for the selected month
    const activitiesInMonth = activities.filter(activity => {
        const activityDate = new Date(activity.created_at);
        return activityDate.getMonth() === selectedMonth && activityDate.getFullYear() === currentYear;
    });

    const handleDownload = async () => {
        setIsGenerating(true);

        try {
            // Dynamic import to avoid SSR issues
            const { generateActivityReportPDF } = await import('@/lib/pdf-generator');

            await generateActivityReportPDF({
                clientName,
                activities,
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
                        Download Activity Report
                    </DialogTitle>
                    <DialogDescription>
                        Generate a PDF report of all logged activities for {clientName}.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-1 py-4">
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
                            <span className="font-medium text-foreground">{activitiesInMonth.length}</span>
                            {' '}activit{activitiesInMonth.length !== 1 ? 'ies' : 'y'} recorded in {MONTHS[selectedMonth]} {currentYear}
                        </p>
                        {activitiesInMonth.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Report will be grouped by contact for easy reading.
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDownload}
                        disabled={isGenerating || activitiesInMonth.length === 0}
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
