import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Activity, DataColumn, DataRow, PeriodData, TimeTrackingConfig, StatusOption } from '@/lib/db/types';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

interface GeneratePDFParams {
    tableName: string;
    columns: DataColumn[];
    rows: DataRow[];
    timeTracking: TimeTrackingConfig | null;
    periodData: Record<string, PeriodData[]>;
    selectedMonth: number;
    year: number;
}

// Status color mappings for PDF
const STATUS_COLORS: Record<string, { r: number; g: number; b: number }> = {
    green: { r: 16, g: 185, b: 129 },
    yellow: { r: 245, g: 158, b: 11 },
    orange: { r: 249, g: 115, b: 22 },
    red: { r: 239, g: 68, b: 68 },
    blue: { r: 59, g: 130, b: 246 },
    purple: { r: 139, g: 92, b: 246 },
    gray: { r: 107, g: 114, b: 128 },
};

function getStatusLabel(column: DataColumn, value: string): string {
    const options = column.config?.options as StatusOption[] | undefined;
    const option = options?.find(o => o.value === value);
    return option?.label || value || '-';
}

function getStatusColor(column: DataColumn, value: string): { r: number; g: number; b: number } {
    const options = column.config?.options as StatusOption[] | undefined;
    const option = options?.find(o => o.value === value);
    return option?.color ? STATUS_COLORS[option.color] : STATUS_COLORS.gray;
}

function formatCellValue(column: DataColumn, value: any): string {
    if (value === null || value === undefined || value === '') {
        return '-';
    }

    switch (column.type) {
        case 'currency':
            return `$${Number(value).toLocaleString()}`;
        case 'percentage':
            return `${value}%`;
        case 'number':
            return Number(value).toLocaleString();
        case 'date':
            return new Date(value).toLocaleDateString();
        case 'datetime':
            return new Date(value).toLocaleString();
        case 'checkbox':
            return value ? 'Yes' : 'No';
        case 'status':
            return getStatusLabel(column, value);
        default:
            return String(value);
    }
}

// Column type priorities - higher priority columns are included first
const COLUMN_PRIORITY: Record<string, number> = {
    'text': 10,        // Name columns
    'email': 8,
    'phone': 7,
    'percentage': 9,
    'status': 9,
    'number': 6,
    'select': 5,
    'checkbox': 4,
    'date': 3,
    'url': 1,          // Low priority - often long
    'datetime': 2,
};

// Columns to skip in PDF (typically contain long content)
const SKIP_COLUMN_NAMES = ['address', 'notes', 'description', 'comments', 'url', 'website', 'link'];

// Recommended widths by column type (as percentage of available width)
const COLUMN_WIDTH_HINTS: Record<string, number> = {
    'text': 0.15,
    'email': 0.14,
    'phone': 0.08,
    'percentage': 0.06,
    'status': 0.08,
    'number': 0.06,
    'select': 0.08,
    'checkbox': 0.05,
    'date': 0.08,
    'metric': 0.06,    // Time tracking metrics
    'ytd': 0.06,       // YTD total
};

// Truncate text to max length
function truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 2) + '..';
}

export async function generateAttendeeTrackerPDF({
    tableName,
    columns,
    rows,
    timeTracking,
    periodData,
    selectedMonth,
    year,
}: GeneratePDFParams): Promise<void> {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const availableWidth = pageWidth - (margin * 2);
    const monthName = MONTHS[selectedMonth];

    // Header function for each page
    const addHeader = (pageNumber: number, totalPages: number) => {
        // Title
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text(tableName, margin, 18);

        // Subtitle with month and date
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(`${monthName} ${year} Report`, margin, 25);

        // Generated date - right aligned
        const generatedText = `Generated: ${new Date().toLocaleDateString()}`;
        doc.text(generatedText, pageWidth - margin - doc.getTextWidth(generatedText), 18);

        // Page number - right aligned
        const pageText = `Page ${pageNumber} of ${totalPages}`;
        doc.text(pageText, pageWidth - margin - doc.getTextWidth(pageText), 25);

        // Divider line
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.line(margin, 29, pageWidth - margin, 29);
    };

    // Footer function for each page
    const addFooter = () => {
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text('CS12 - Attendee Tracker Report', margin, pageHeight - 8);
    };

    // Filter and prioritize columns
    const primaryColumn = columns.find(c => c.is_primary) || columns[0];

    // Filter out columns that should be skipped (addresses, long text, etc.)
    const filteredColumns = columns.filter(col => {
        if (col.id === primaryColumn?.id) return false; // Handle primary separately
        const nameLower = col.name.toLowerCase();
        return !SKIP_COLUMN_NAMES.some(skip => nameLower.includes(skip));
    });

    // Sort by priority and limit columns to fit reasonably
    const sortedColumns = [...filteredColumns].sort((a, b) => {
        const priorityA = COLUMN_PRIORITY[a.type] || 0;
        const priorityB = COLUMN_PRIORITY[b.type] || 0;
        return priorityB - priorityA;
    });

    // Calculate how many columns we can fit
    // Reserve space for: primary (15%), metrics, YTD
    let reservedWidth = 0.15; // Primary column
    const numMetrics = timeTracking?.enabled ? timeTracking.metrics.length : 0;
    reservedWidth += numMetrics * 0.06; // Metrics
    if (numMetrics > 0) reservedWidth += 0.06; // YTD column

    const remainingWidth = 1 - reservedWidth;
    let usedWidth = 0;
    const selectedColumns: DataColumn[] = [];

    for (const col of sortedColumns) {
        const colWidth = COLUMN_WIDTH_HINTS[col.type] || 0.08;
        if (usedWidth + colWidth <= remainingWidth + 0.02) { // Small tolerance
            selectedColumns.push(col);
            usedWidth += colWidth;
        }
    }

    // Build table headers
    const headers: string[] = [];
    const colTypes: string[] = []; // Track types for width calculation

    if (primaryColumn) {
        headers.push(primaryColumn.name);
        colTypes.push('text');
    }

    selectedColumns.forEach(col => {
        headers.push(col.name);
        colTypes.push(col.type);
    });

    // Add time tracking metric headers if enabled
    if (timeTracking?.enabled) {
        timeTracking.metrics.forEach(metric => {
            // Shorter header names for metrics
            headers.push(metric.name);
            colTypes.push('metric');
        });
        headers.push('YTD');
        colTypes.push('ytd');
    }

    // Build table body with smart truncation
    const body: (string | { content: string; styles?: any })[][] = rows.map(row => {
        const rowData: (string | { content: string; styles?: any })[] = [];

        // Primary column - allow more characters for names
        if (primaryColumn) {
            const val = formatCellValue(primaryColumn, row.data[primaryColumn.id]);
            rowData.push(truncateText(val, 25));
        }

        // Other columns with appropriate truncation
        selectedColumns.forEach(col => {
            const value = row.data[col.id];
            const formatted = formatCellValue(col, value);

            if (col.type === 'status') {
                const color = getStatusColor(col, value);
                rowData.push({
                    content: truncateText(formatted, 12),
                    styles: {
                        fillColor: [color.r, color.g, color.b],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                    }
                });
            } else if (col.type === 'percentage') {
                const numValue = parseFloat(value) || 0;
                let textColor = [239, 68, 68]; // red
                if (numValue >= 80) textColor = [16, 185, 129]; // green
                else if (numValue >= 50) textColor = [245, 158, 11]; // yellow
                else if (numValue >= 20) textColor = [249, 115, 22]; // orange

                rowData.push({
                    content: formatted,
                    styles: {
                        textColor: textColor,
                        fontStyle: 'bold',
                    }
                });
            } else if (col.type === 'email') {
                // Truncate emails but keep them readable
                rowData.push(truncateText(formatted, 22));
            } else if (col.type === 'phone') {
                rowData.push(formatted);
            } else {
                rowData.push(truncateText(formatted, 15));
            }
        });

        // Add period data for selected month
        if (timeTracking?.enabled) {
            const periods = periodData[row.id] || [];
            const monthPeriod = periods.find(p => {
                const periodStart = new Date(p.period_start);
                return periodStart.getMonth() === selectedMonth;
            });

            let ytdTotal = 0;
            timeTracking.metrics.forEach(metric => {
                const value = monthPeriod?.metrics[metric.id] || 0;
                rowData.push(value.toString());

                // Calculate YTD
                ytdTotal += periods.reduce((sum, p) => {
                    const periodStart = new Date(p.period_start);
                    if (periodStart.getMonth() <= selectedMonth && periodStart.getFullYear() === year) {
                        return sum + (p.metrics[metric.id] || 0);
                    }
                    return sum;
                }, 0);
            });
            rowData.push(ytdTotal.toString());
        }

        return rowData;
    });

    // Calculate smart column widths
    const colWidths = colTypes.map((type, index) => {
        if (index === 0) return availableWidth * 0.14; // Primary column
        return availableWidth * (COLUMN_WIDTH_HINTS[type] || 0.07);
    });

    // Generate table
    const startY = 35;

    autoTable(doc, {
        head: [headers],
        body: body,
        startY: startY,
        margin: { left: margin, right: margin, top: 35 },
        styles: {
            fontSize: 8,
            cellPadding: 3,
            lineColor: [229, 231, 235],
            lineWidth: 0.1,
            overflow: 'ellipsize',
            cellWidth: 'wrap',
        },
        headStyles: {
            fillColor: [249, 250, 251],
            textColor: [55, 65, 81],
            fontStyle: 'bold',
            fontSize: 8,
        },
        alternateRowStyles: {
            fillColor: [254, 254, 254],
        },
        columnStyles: Object.fromEntries(
            colWidths.map((width, i) => [i, { cellWidth: width }])
        ),
        didDrawPage: (data) => {
            // Add header on every page
            addHeader(data.pageNumber, doc.getNumberOfPages());
            addFooter();
        },
        willDrawCell: (data) => {
            // Handle custom cell styling from body data
            if (data.section === 'body') {
                const cellData = body[data.row.index]?.[data.column.index];
                if (typeof cellData === 'object' && cellData.styles) {
                    if (cellData.styles.fillColor) {
                        data.cell.styles.fillColor = cellData.styles.fillColor;
                    }
                    if (cellData.styles.textColor) {
                        data.cell.styles.textColor = cellData.styles.textColor;
                    }
                    if (cellData.styles.fontStyle) {
                        data.cell.styles.fontStyle = cellData.styles.fontStyle;
                    }
                }
            }
        },
    });

    // Add summary section on last page if there's room, otherwise new page
    const finalY = (doc as any).lastAutoTable?.finalY || startY;
    let summaryY = finalY + 12;

    if (summaryY > pageHeight - 45) {
        doc.addPage();
        summaryY = 38;
        // didDrawPage already adds header, but we need to add it manually for new pages after table
        addHeader(doc.getNumberOfPages(), doc.getNumberOfPages());
        addFooter();
    }

    // Summary section - compact horizontal layout
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Summary', margin, summaryY);
    summaryY += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);

    // First line: attendee count and period
    doc.text(`Total Attendees: ${rows.length}  |  Report Period: ${monthName} ${year}`, margin, summaryY);
    summaryY += 6;

    // Add time tracking summary if enabled - horizontal layout
    if (timeTracking?.enabled) {
        const metricSummaries: string[] = [];

        timeTracking.metrics.forEach(metric => {
            let monthTotal = 0;
            let ytdTotal = 0;

            rows.forEach(row => {
                const periods = periodData[row.id] || [];
                const monthPeriod = periods.find(p => {
                    const periodStart = new Date(p.period_start);
                    return periodStart.getMonth() === selectedMonth;
                });
                monthTotal += monthPeriod?.metrics[metric.id] || 0;

                // YTD calculation
                periods.forEach(p => {
                    const periodStart = new Date(p.period_start);
                    if (periodStart.getMonth() <= selectedMonth && periodStart.getFullYear() === year) {
                        ytdTotal += p.metrics[metric.id] || 0;
                    }
                });
            });

            metricSummaries.push(`${metric.name}: ${monthTotal} (YTD: ${ytdTotal})`);
        });

        doc.text(metricSummaries.join('  |  '), margin, summaryY);
    }

    // Save the PDF
    const fileName = `${tableName.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`;
    doc.save(fileName);
}

// Activity Report PDF Generator
interface GenerateActivityReportParams {
    clientName: string;
    activities: Activity[];
    selectedMonth: number;
    year: number;
}

// Outcome color mappings
const OUTCOME_COLORS: Record<string, { r: number; g: number; b: number }> = {
    positive: { r: 16, g: 185, b: 129 },      // green
    neutral: { r: 107, g: 114, b: 128 },      // gray
    negative: { r: 239, g: 68, b: 68 },       // red
    follow_up_needed: { r: 245, g: 158, b: 11 }, // yellow/amber
};

const OUTCOME_LABELS: Record<string, string> = {
    positive: 'Positive',
    neutral: 'Neutral',
    negative: 'Negative',
    follow_up_needed: 'Follow-up Needed',
};

const ACTIVITY_TYPE_ICONS: Record<string, string> = {
    phone: '☎',
    email: '✉',
    text: '💬',
};

export async function generateActivityReportPDF({
    clientName,
    activities,
    selectedMonth,
    year,
}: GenerateActivityReportParams): Promise<void> {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    const monthName = MONTHS[selectedMonth];

    // Filter activities for the selected month
    const filteredActivities = activities.filter(activity => {
        const activityDate = new Date(activity.created_at);
        return activityDate.getMonth() === selectedMonth && activityDate.getFullYear() === year;
    });

    // Group activities by contact name
    const activitiesByContact: Record<string, Activity[]> = {};
    filteredActivities.forEach(activity => {
        const contactKey = activity.contact_name || 'Unknown Contact';
        if (!activitiesByContact[contactKey]) {
            activitiesByContact[contactKey] = [];
        }
        activitiesByContact[contactKey].push(activity);
    });

    // Sort contacts alphabetically
    const sortedContacts = Object.keys(activitiesByContact).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
    );

    // Calculate summary stats
    const totalActivities = filteredActivities.length;
    const byType = {
        phone: filteredActivities.filter(a => a.activity_type === 'phone').length,
        email: filteredActivities.filter(a => a.activity_type === 'email').length,
        text: filteredActivities.filter(a => a.activity_type === 'text').length,
    };
    const byOutcome = {
        positive: filteredActivities.filter(a => a.outcome === 'positive').length,
        neutral: filteredActivities.filter(a => a.outcome === 'neutral').length,
        negative: filteredActivities.filter(a => a.outcome === 'negative').length,
        follow_up_needed: filteredActivities.filter(a => a.outcome === 'follow_up_needed').length,
    };

    let currentY = margin;
    let currentPage = 1;

    // Helper to check if we need a new page
    const checkPageBreak = (requiredHeight: number) => {
        if (currentY + requiredHeight > pageHeight - margin) {
            doc.addPage();
            currentPage++;
            currentY = margin;
            return true;
        }
        return false;
    };

    // Draw header
    const drawHeader = () => {
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text('Activity Report', margin, currentY + 7);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(`${clientName} • ${monthName} ${year}`, margin, currentY + 14);

        // Generated date - right aligned
        const generatedText = `Generated: ${new Date().toLocaleDateString()}`;
        doc.text(generatedText, pageWidth - margin - doc.getTextWidth(generatedText), currentY + 7);

        currentY += 20;

        // Divider line
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;
    };

    // Draw summary section
    const drawSummary = () => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text('Summary', margin, currentY);
        currentY += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);

        // Total and by type
        doc.text(`Total Activities: ${totalActivities}`, margin, currentY);
        currentY += 6;
        doc.text(`☎ Phone: ${byType.phone}    ✉ Email: ${byType.email}    💬 Text: ${byType.text}`, margin, currentY);
        currentY += 8;

        // By outcome with colored dots
        let outcomeX = margin;
        Object.entries(byOutcome).forEach(([outcome, count]) => {
            if (count > 0) {
                const color = OUTCOME_COLORS[outcome] || OUTCOME_COLORS.neutral;
                doc.setFillColor(color.r, color.g, color.b);
                doc.circle(outcomeX + 2, currentY - 1.5, 2, 'F');
                doc.setTextColor(55, 65, 81);
                const label = `${OUTCOME_LABELS[outcome]}: ${count}`;
                doc.text(label, outcomeX + 6, currentY);
                outcomeX += doc.getTextWidth(label) + 15;
            }
        });
        currentY += 10;

        // Contacts count
        doc.setTextColor(107, 114, 128);
        doc.text(`${sortedContacts.length} contact${sortedContacts.length !== 1 ? 's' : ''} with activity this month`, margin, currentY);
        currentY += 12;

        // Divider
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 10;
    };

    // Draw a contact section with their activities
    const drawContactSection = (contactName: string, contactActivities: Activity[]) => {
        // Sort activities by date (newest first)
        const sorted = [...contactActivities].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Calculate height needed for contact header
        const headerHeight = 15;
        checkPageBreak(headerHeight);

        // Contact header with background
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, currentY - 3, contentWidth, 10, 'F');

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text(contactName, margin + 3, currentY + 3);

        // Activity count badge
        const countText = `${sorted.length} activit${sorted.length !== 1 ? 'ies' : 'y'}`;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(countText, pageWidth - margin - doc.getTextWidth(countText) - 3, currentY + 3);

        currentY += 12;

        // Draw each activity
        sorted.forEach((activity, index) => {
            // Estimate height needed for this activity
            const descriptionLines = doc.splitTextToSize(activity.description || '', contentWidth - 10);
            const activityHeight = 12 + (descriptionLines.length * 5) + 8;

            checkPageBreak(activityHeight);

            // Activity header line: Date • Type • Outcome
            const activityDate = new Date(activity.created_at);
            const dateStr = activityDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            const timeStr = activityDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
            });

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(55, 65, 81);

            const typeIcon = ACTIVITY_TYPE_ICONS[activity.activity_type] || '';
            const headerText = `${dateStr} at ${timeStr}  ${typeIcon} ${activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1)}`;
            doc.text(headerText, margin + 3, currentY);

            // Outcome badge (right side)
            if (activity.outcome) {
                const outcomeColor = OUTCOME_COLORS[activity.outcome] || OUTCOME_COLORS.neutral;
                const outcomeLabel = OUTCOME_LABELS[activity.outcome] || activity.outcome;

                doc.setFillColor(outcomeColor.r, outcomeColor.g, outcomeColor.b);
                doc.circle(pageWidth - margin - doc.getTextWidth(outcomeLabel) - 8, currentY - 1, 1.5, 'F');

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(outcomeColor.r, outcomeColor.g, outcomeColor.b);
                doc.text(outcomeLabel, pageWidth - margin - doc.getTextWidth(outcomeLabel) - 3, currentY);
            }

            currentY += 6;

            // Description
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(75, 85, 99);

            descriptionLines.forEach((line: string) => {
                doc.text(line, margin + 3, currentY);
                currentY += 4.5;
            });

            currentY += 4;

            // Light separator between activities (not after last one)
            if (index < sorted.length - 1) {
                doc.setDrawColor(243, 244, 246);
                doc.setLineWidth(0.2);
                doc.line(margin + 3, currentY, pageWidth - margin - 3, currentY);
                currentY += 6;
            }
        });

        currentY += 8;
    };

    // Build the document
    drawHeader();

    if (filteredActivities.length === 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(`No activities recorded for ${monthName} ${year}.`, margin, currentY);
    } else {
        drawSummary();

        // Draw each contact section
        sortedContacts.forEach(contactName => {
            drawContactSection(contactName, activitiesByContact[contactName]);
        });
    }

    // Add page numbers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(156, 163, 175);
        doc.text(`Page ${i} of ${totalPages}`, margin, pageHeight - 10);
        doc.text('Activity Report', pageWidth - margin - doc.getTextWidth('Activity Report'), pageHeight - 10);
    }

    // Save the PDF
    const fileName = `${clientName.replace(/\s+/g, '_')}_Activity_Report_${monthName}_${year}.pdf`;
    doc.save(fileName);
}

// Progress Report PDF Generator
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

interface GenerateProgressReportParams {
    clientName: string;
    tables: ProgressTable[];
    contacts: ProgressContact[];
    selectedMonth: number;
    year: number;
}

export async function generateProgressReportPDF({
    clientName,
    tables,
    contacts,
    selectedMonth,
    year,
}: GenerateProgressReportParams): Promise<void> {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    const monthName = MONTHS[selectedMonth];

    // Group contacts by table
    const contactsByTable: Record<string, ProgressContact[]> = {};
    contacts.forEach(contact => {
        if (!contactsByTable[contact.tableId]) {
            contactsByTable[contact.tableId] = [];
        }
        contactsByTable[contact.tableId].push(contact);
    });

    // Filter to only tables with contacts
    const tablesWithContacts = tables.filter(t => contactsByTable[t.id]?.length > 0);

    let currentPage = 1;

    // Header function for each page
    const addHeader = (pageNumber: number, totalPages: number) => {
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text('Progress Report', margin, 20);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(`${clientName} • ${monthName} ${year}`, margin, 28);

        // Generated date - right aligned
        const generatedText = `Generated: ${new Date().toLocaleDateString()}`;
        doc.text(generatedText, pageWidth - margin - doc.getTextWidth(generatedText), 20);

        // Page number - right aligned
        const pageText = `Page ${pageNumber} of ${totalPages}`;
        doc.text(pageText, pageWidth - margin - doc.getTextWidth(pageText), 28);

        // Divider line
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.line(margin, 32, pageWidth - margin, 32);
    };

    // Footer function for each page
    const addFooter = () => {
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text('Progress Report', margin, pageHeight - 10);
    };

    // Draw each table section
    let isFirstTable = true;
    tablesWithContacts.forEach((table, tableIndex) => {
        const tableContacts = contactsByTable[table.id] || [];
        const metrics = table.time_tracking?.metrics || [];

        if (!isFirstTable) {
            doc.addPage();
            currentPage++;
        }
        isFirstTable = false;

        // Table section header
        let startY = 40;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text(table.name, margin, startY);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(`${tableContacts.length} contact${tableContacts.length !== 1 ? 's' : ''}`, margin + doc.getTextWidth(table.name) + 5, startY);

        startY += 10;

        // Build table headers
        const headers: string[] = ['Name', 'Email'];
        metrics.forEach(metric => {
            headers.push(metric.name);
        });
        headers.push('Total');
        headers.push('Change');

        // Build table body - sorted by name
        const sortedContacts = [...tableContacts].sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );

        const body: (string | { content: string; styles?: any })[][] = sortedContacts.map(contact => {
            const row: (string | { content: string; styles?: any })[] = [];

            // Name
            row.push(contact.name);

            // Email
            row.push(contact.email || '-');

            // Metric values from metricsSummary
            metrics.forEach(metric => {
                const value = contact.metricsSummary?.[metric.name] ?? 0;
                row.push(value.toString());
            });

            // Total
            const total = contact.currentPeriodTotal ?? 0;
            row.push({
                content: total.toString(),
                styles: { fontStyle: 'bold' }
            });

            // Change percentage
            const prevTotal = contact.previousPeriodTotal ?? 0;
            let changeText = '-';
            let changeColor = [107, 114, 128]; // gray

            if (prevTotal > 0) {
                const changePercent = Math.round(((total - prevTotal) / prevTotal) * 100);
                changeText = `${changePercent >= 0 ? '+' : ''}${changePercent}%`;
                changeColor = changePercent >= 0 ? [16, 185, 129] : [239, 68, 68]; // green or red
            }

            row.push({
                content: changeText,
                styles: { textColor: changeColor, fontStyle: 'bold' }
            });

            return row;
        });

        // Calculate column widths
        const numCols = headers.length;
        const nameWidth = contentWidth * 0.18;
        const emailWidth = contentWidth * 0.20;
        const totalWidth = contentWidth * 0.08;
        const changeWidth = contentWidth * 0.08;
        const remainingWidth = contentWidth - nameWidth - emailWidth - totalWidth - changeWidth;
        const metricWidth = metrics.length > 0 ? remainingWidth / metrics.length : remainingWidth;

        const colWidths = [nameWidth, emailWidth];
        metrics.forEach(() => colWidths.push(metricWidth));
        colWidths.push(totalWidth, changeWidth);

        // Generate table
        autoTable(doc, {
            head: [headers],
            body: body,
            startY: startY,
            margin: { left: margin, right: margin },
            styles: {
                fontSize: 9,
                cellPadding: 4,
                lineColor: [229, 231, 235],
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: [249, 250, 251],
                textColor: [55, 65, 81],
                fontStyle: 'bold',
                fontSize: 9,
            },
            alternateRowStyles: {
                fillColor: [255, 255, 255],
            },
            columnStyles: Object.fromEntries(
                colWidths.map((width, i) => [i, { cellWidth: width }])
            ),
            willDrawCell: (data) => {
                // Handle custom cell styling from body data
                const cellData = body[data.row.index]?.[data.column.index];
                if (typeof cellData === 'object' && cellData.styles) {
                    if (cellData.styles.textColor) {
                        data.cell.styles.textColor = cellData.styles.textColor;
                    }
                    if (cellData.styles.fontStyle) {
                        data.cell.styles.fontStyle = cellData.styles.fontStyle;
                    }
                }
            },
        });

        // Add summary for this table
        const finalY = (doc as any).lastAutoTable?.finalY || startY;
        let summaryY = finalY + 10;

        if (summaryY < pageHeight - 40) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(55, 65, 81);
            doc.text('Summary', margin, summaryY);
            summaryY += 7;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 114, 128);

            // Calculate totals for each metric
            const metricTotals: Record<string, number> = {};
            metrics.forEach(metric => {
                metricTotals[metric.name] = 0;
            });

            let grandTotal = 0;
            tableContacts.forEach(contact => {
                grandTotal += contact.currentPeriodTotal ?? 0;
                metrics.forEach(metric => {
                    metricTotals[metric.name] += contact.metricsSummary?.[metric.name] ?? 0;
                });
            });

            const summaryParts: string[] = [`Total: ${grandTotal}`];
            metrics.forEach(metric => {
                summaryParts.push(`${metric.name}: ${metricTotals[metric.name]}`);
            });

            doc.text(summaryParts.join('    '), margin, summaryY);
        }
    });

    // Handle empty state
    if (tablesWithContacts.length === 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(`No progress data available for ${monthName} ${year}.`, margin, 50);
    }

    // Add headers/footers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addHeader(i, totalPages);
        addFooter();
    }

    // Save the PDF
    const fileName = `${clientName.replace(/\s+/g, '_')}_Progress_Report_${monthName}_${year}.pdf`;
    doc.save(fileName);
}
