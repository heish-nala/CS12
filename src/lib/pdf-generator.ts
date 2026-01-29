import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Activity, DataColumn, DataRow, PeriodData, TimeTrackingConfig, StatusOption } from '@/lib/db/types';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// ============================================
// CONSISTENT COLOR PALETTE FOR ALL PDFs
// ============================================

// Primary accent color (professional blue)
const ACCENT_COLOR = { r: 59, g: 130, b: 246 }; // #3B82F6

// Text colors
const TEXT_PRIMARY = { r: 31, g: 41, b: 55 };    // Dark gray for headings
const TEXT_SECONDARY = { r: 107, g: 114, b: 128 }; // Medium gray for labels
const TEXT_MUTED = { r: 156, g: 163, b: 175 };   // Light gray for footers

// Background colors
const BG_HEADER = { r: 239, g: 246, b: 255 };    // Very light blue for headers
const BG_SECTION = { r: 249, g: 250, b: 251 };   // Light gray for sections
const BG_ALTERNATE = { r: 248, g: 250, b: 252 }; // Subtle alternate row color

// Border colors
const BORDER_LIGHT = { r: 229, g: 231, b: 235 }; // Light gray borders
const BORDER_ACCENT = { r: 147, g: 197, b: 253 }; // Light blue accent border

// Status colors (semantic - for outcomes and statuses)
const STATUS_COLORS: Record<string, { r: number; g: number; b: number }> = {
    green: { r: 16, g: 185, b: 129 },    // Success/Positive
    yellow: { r: 245, g: 158, b: 11 },   // Warning/Follow-up
    orange: { r: 249, g: 115, b: 22 },   // Caution
    red: { r: 239, g: 68, b: 68 },       // Error/Negative
    blue: { r: 59, g: 130, b: 246 },     // Info/Primary
    purple: { r: 139, g: 92, b: 246 },   // Special
    gray: { r: 107, g: 114, b: 128 },    // Neutral
};

// Status background colors (lighter versions for cells)
const STATUS_BG_COLORS: Record<string, { r: number; g: number; b: number }> = {
    green: { r: 220, g: 252, b: 231 },   // Light green bg
    yellow: { r: 254, g: 249, b: 195 },  // Light yellow bg
    orange: { r: 255, g: 237, b: 213 },  // Light orange bg
    red: { r: 254, g: 226, b: 226 },     // Light red bg
    blue: { r: 219, g: 234, b: 254 },    // Light blue bg
    purple: { r: 237, g: 233, b: 254 },  // Light purple bg
    gray: { r: 243, g: 244, b: 246 },    // Light gray bg
};

interface GeneratePDFParams {
    tableName: string;
    columns: DataColumn[];
    rows: DataRow[];
    timeTracking: TimeTrackingConfig | null;
    periodData: Record<string, PeriodData[]>;
    selectedMonth: number;
    year: number;
}

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
        // Accent bar at top
        doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.rect(0, 0, pageWidth, 3, 'F');

        // Title
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
        doc.text(tableName, margin, 18);

        // Subtitle with month and date - with accent color
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.text(`${monthName} ${year} Report`, margin, 25);

        // Generated date - right aligned
        doc.setTextColor(TEXT_SECONDARY.r, TEXT_SECONDARY.g, TEXT_SECONDARY.b);
        const generatedText = `Generated: ${new Date().toLocaleDateString()}`;
        doc.text(generatedText, pageWidth - margin - doc.getTextWidth(generatedText), 18);

        // Page number - right aligned
        const pageText = `Page ${pageNumber} of ${totalPages}`;
        doc.text(pageText, pageWidth - margin - doc.getTextWidth(pageText), 25);

        // Divider line with subtle accent
        doc.setDrawColor(BORDER_ACCENT.r, BORDER_ACCENT.g, BORDER_ACCENT.b);
        doc.setLineWidth(0.5);
        doc.line(margin, 29, pageWidth - margin, 29);
    };

    // Footer function for each page
    const addFooter = () => {
        // Footer line
        doc.setDrawColor(BORDER_LIGHT.r, BORDER_LIGHT.g, BORDER_LIGHT.b);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        doc.setFontSize(8);
        doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
        doc.text('CS12 - Attendee Tracker Report', margin, pageHeight - 7);

        // Small accent dot
        doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.circle(margin + doc.getTextWidth('CS12') + 2, pageHeight - 8.5, 0.8, 'F');
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
            lineColor: [BORDER_LIGHT.r, BORDER_LIGHT.g, BORDER_LIGHT.b],
            lineWidth: 0.1,
            overflow: 'ellipsize',
            cellWidth: 'wrap',
        },
        headStyles: {
            fillColor: [BG_HEADER.r, BG_HEADER.g, BG_HEADER.b],
            textColor: [ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b],
            fontStyle: 'bold',
            fontSize: 8,
        },
        alternateRowStyles: {
            fillColor: [BG_ALTERNATE.r, BG_ALTERNATE.g, BG_ALTERNATE.b],
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

    // Summary section - styled card with accent
    const summaryCardHeight = timeTracking?.enabled ? 28 : 20;

    // Draw summary card background
    doc.setFillColor(BG_HEADER.r, BG_HEADER.g, BG_HEADER.b);
    doc.roundedRect(margin, summaryY - 4, availableWidth, summaryCardHeight, 2, 2, 'F');

    // Left accent border
    doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
    doc.roundedRect(margin, summaryY - 4, 3, summaryCardHeight, 2, 0, 'F');
    doc.rect(margin + 1, summaryY - 4, 2, summaryCardHeight, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
    doc.text('Summary', margin + 8, summaryY + 3);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_SECONDARY.r, TEXT_SECONDARY.g, TEXT_SECONDARY.b);

    // First line: attendee count and period
    const statsY = summaryY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
    doc.text(`${rows.length}`, margin + 8, statsY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_SECONDARY.r, TEXT_SECONDARY.g, TEXT_SECONDARY.b);
    doc.text(` Attendees  •  Report Period: ${monthName} ${year}`, margin + 8 + doc.getTextWidth(`${rows.length}`), statsY);

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

        doc.text(metricSummaries.join('  •  '), margin + 8, statsY + 7);
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
    follow_up_needed: 'Follow-up',
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
    phone: 'Phone',
    email: 'Email',
    text: 'Text',
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
    const cardPadding = 4;

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

    // Helper to check if we need a new page
    const checkPageBreak = (requiredHeight: number) => {
        if (currentY + requiredHeight > pageHeight - margin - 10) {
            doc.addPage();
            currentY = margin;
            return true;
        }
        return false;
    };

    // Draw a rounded rectangle (card) with optional accent border
    const drawCard = (x: number, y: number, width: number, height: number, fillColor?: {r: number, g: number, b: number}, accentColor?: {r: number, g: number, b: number}) => {
        const radius = 2;
        doc.setDrawColor(BORDER_LIGHT.r, BORDER_LIGHT.g, BORDER_LIGHT.b);
        doc.setLineWidth(0.3);
        if (fillColor) {
            doc.setFillColor(fillColor.r, fillColor.g, fillColor.b);
            doc.roundedRect(x, y, width, height, radius, radius, 'FD');
        } else {
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(x, y, width, height, radius, radius, 'FD');
        }
        // Add left accent border if specified
        if (accentColor) {
            doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
            doc.roundedRect(x, y, 2, height, radius, 0, 'F');
            doc.rect(x + 1, y, 1, height, 'F');
        }
    };

    // Draw a pill/badge
    const drawBadge = (text: string, x: number, y: number, color: {r: number, g: number, b: number}) => {
        doc.setFontSize(7);
        const textWidth = doc.getTextWidth(text);
        const badgeWidth = textWidth + 6;
        const badgeHeight = 5;

        doc.setFillColor(color.r, color.g, color.b);
        doc.roundedRect(x, y - 3.5, badgeWidth, badgeHeight, 1.5, 1.5, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(text, x + 3, y);

        return badgeWidth;
    };

    // Draw header
    const drawHeader = () => {
        // Accent bar at top
        doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.rect(0, 0, pageWidth, 3, 'F');

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
        doc.text('Activity Report', margin, currentY + 6);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_SECONDARY.r, TEXT_SECONDARY.g, TEXT_SECONDARY.b);
        doc.text(`${clientName}`, margin, currentY + 12);

        // Month badge with accent
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.text(`${monthName} ${year}`, margin + doc.getTextWidth(clientName) + 5, currentY + 12);

        // Generated date - right aligned
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
        doc.setFontSize(8);
        const generatedText = `Generated: ${new Date().toLocaleDateString()}`;
        doc.text(generatedText, pageWidth - margin - doc.getTextWidth(generatedText), currentY + 6);

        currentY += 18;

        // Divider line with accent
        doc.setDrawColor(BORDER_ACCENT.r, BORDER_ACCENT.g, BORDER_ACCENT.b);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;
    };

    // Draw summary section as a card with accent border
    const drawSummary = () => {
        const summaryHeight = 28;

        // Card background
        doc.setFillColor(BG_HEADER.r, BG_HEADER.g, BG_HEADER.b);
        doc.roundedRect(margin, currentY, contentWidth, summaryHeight, 2, 2, 'F');

        // Left accent border
        doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.roundedRect(margin, currentY, 3, summaryHeight, 2, 0, 'F');
        doc.rect(margin + 1, currentY, 2, summaryHeight, 'F');

        // Title
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
        doc.text('Summary', margin + 8, currentY + 6);

        // Stats row
        doc.setFontSize(9);
        doc.setTextColor(TEXT_SECONDARY.r, TEXT_SECONDARY.g, TEXT_SECONDARY.b);

        let statsX = margin + 8;
        const statsY = currentY + 14;

        // Total with accent color
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.text(`${totalActivities}`, statsX, statsY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_SECONDARY.r, TEXT_SECONDARY.g, TEXT_SECONDARY.b);
        doc.text(' total', statsX + doc.getTextWidth(`${totalActivities}`), statsY);
        statsX += doc.getTextWidth(`${totalActivities} total`) + 10;

        // By type with subtle separators
        doc.text(`Phone: ${byType.phone}  •  Email: ${byType.email}  •  Text: ${byType.text}`, statsX, statsY);

        // Outcome badges row
        let badgeX = margin + 8;
        const badgeY = currentY + 22;

        Object.entries(byOutcome).forEach(([outcome, count]) => {
            if (count > 0) {
                const color = OUTCOME_COLORS[outcome] || OUTCOME_COLORS.neutral;
                const label = `${OUTCOME_LABELS[outcome]}: ${count}`;
                const badgeWidth = drawBadge(label, badgeX, badgeY, color);
                badgeX += badgeWidth + 4;
            }
        });

        currentY += summaryHeight + 8;
    };

    // Draw a contact section with their activities as cards
    const drawContactSection = (contactName: string, contactActivities: Activity[]) => {
        // Sort activities by date (newest first)
        const sorted = [...contactActivities].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Calculate height needed for header + first activity card
        // This prevents orphaned headers at page bottom
        const headerHeight = 14;
        let firstCardHeight = 25; // Default estimate
        if (sorted.length > 0) {
            doc.setFontSize(9);
            const firstDesc = sorted[0].description || 'No description';
            const firstDescLines = doc.splitTextToSize(firstDesc, contentWidth - (cardPadding * 2) - 4);
            firstCardHeight = 14 + (firstDescLines.length * 4) + 4;
        }

        // Check if we have room for header + first activity together
        checkPageBreak(headerHeight + firstCardHeight);

        // Contact section header with accent
        doc.setFillColor(BG_SECTION.r, BG_SECTION.g, BG_SECTION.b);
        doc.roundedRect(margin, currentY, contentWidth, 10, 1, 1, 'F');

        // Small accent indicator
        doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.circle(margin + 4, currentY + 5, 1.5, 'F');

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
        doc.text(contactName, margin + 10, currentY + 6.5);

        // Activity count badge
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const countText = `${sorted.length}`;
        const countBadgeX = pageWidth - margin - 12;
        doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.roundedRect(countBadgeX, currentY + 2, 8, 6, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(countText, countBadgeX + 4 - doc.getTextWidth(countText) / 2, currentY + 6);

        currentY += 14;

        // Draw each activity as a card
        sorted.forEach((activity, index) => {
            // Calculate card height based on description
            doc.setFontSize(9);
            const descriptionLines = doc.splitTextToSize(activity.description || 'No description', contentWidth - (cardPadding * 2) - 8);
            const cardHeight = 14 + (descriptionLines.length * 4);

            checkPageBreak(cardHeight + 4);

            // Get outcome color for accent
            const outcomeAccent = activity.outcome ? OUTCOME_COLORS[activity.outcome] : undefined;

            // Draw card with outcome-based accent border
            drawCard(margin, currentY, contentWidth, cardHeight, undefined, outcomeAccent);

            // Header row inside card: Date | Type | Outcome
            const activityDate = new Date(activity.created_at);
            const dateStr = activityDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            });
            const timeStr = activityDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
            });

            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(TEXT_SECONDARY.r, TEXT_SECONDARY.g, TEXT_SECONDARY.b);
            doc.text(`${dateStr}, ${timeStr}`, margin + cardPadding + 4, currentY + 5);

            // Type badge with subtle styling
            const typeLabel = ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type;
            const typeX = margin + cardPadding + doc.getTextWidth(`${dateStr}, ${timeStr}`) + 10;
            doc.setFillColor(BG_SECTION.r, BG_SECTION.g, BG_SECTION.b);
            const typeWidth = doc.getTextWidth(typeLabel) + 6;
            doc.roundedRect(typeX, currentY + 1.5, typeWidth, 5, 1.5, 1.5, 'F');
            doc.setTextColor(TEXT_SECONDARY.r, TEXT_SECONDARY.g, TEXT_SECONDARY.b);
            doc.setFontSize(7);
            doc.text(typeLabel, typeX + 3, currentY + 5);

            // Outcome badge (right side)
            if (activity.outcome) {
                const outcomeColor = OUTCOME_COLORS[activity.outcome] || OUTCOME_COLORS.neutral;
                const outcomeLabel = OUTCOME_LABELS[activity.outcome] || activity.outcome;
                drawBadge(outcomeLabel, pageWidth - margin - doc.getTextWidth(outcomeLabel) - 10, currentY + 5, outcomeColor);
            }

            // Description
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);

            let descY = currentY + 11;
            descriptionLines.forEach((line: string) => {
                doc.text(line, margin + cardPadding + 4, descY);
                descY += 4;
            });

            currentY += cardHeight + 3;
        });

        currentY += 6;
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

    // Add page numbers and footer to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Footer line
        doc.setDrawColor(BORDER_LIGHT.r, BORDER_LIGHT.g, BORDER_LIGHT.b);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
        doc.text(`Page ${i} of ${totalPages}`, margin, pageHeight - 7);

        // Accent dot + report name
        doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        const reportLabel = 'Activity Report';
        const labelX = pageWidth - margin - doc.getTextWidth(reportLabel);
        doc.circle(labelX - 3, pageHeight - 8.5, 0.8, 'F');
        doc.text(reportLabel, labelX, pageHeight - 7);
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
        // Accent bar at top
        doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.rect(0, 0, pageWidth, 3, 'F');

        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
        doc.text('Progress Report', margin, 20);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_SECONDARY.r, TEXT_SECONDARY.g, TEXT_SECONDARY.b);
        doc.text(`${clientName}`, margin, 28);

        // Month with accent color
        doc.setTextColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.setFont('helvetica', 'bold');
        doc.text(`${monthName} ${year}`, margin + doc.getTextWidth(clientName) + 5, 28);

        // Generated date - right aligned
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_SECONDARY.r, TEXT_SECONDARY.g, TEXT_SECONDARY.b);
        const generatedText = `Generated: ${new Date().toLocaleDateString()}`;
        doc.text(generatedText, pageWidth - margin - doc.getTextWidth(generatedText), 20);

        // Page number - right aligned
        const pageText = `Page ${pageNumber} of ${totalPages}`;
        doc.text(pageText, pageWidth - margin - doc.getTextWidth(pageText), 28);

        // Divider line with accent
        doc.setDrawColor(BORDER_ACCENT.r, BORDER_ACCENT.g, BORDER_ACCENT.b);
        doc.setLineWidth(0.5);
        doc.line(margin, 32, pageWidth - margin, 32);
    };

    // Footer function for each page
    const addFooter = () => {
        // Footer line
        doc.setDrawColor(BORDER_LIGHT.r, BORDER_LIGHT.g, BORDER_LIGHT.b);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

        doc.setFontSize(8);
        doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
        doc.text('Progress Report', margin, pageHeight - 9);

        // Accent dot
        doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.circle(margin + doc.getTextWidth('Progress Report') + 3, pageHeight - 10.5, 0.8, 'F');
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

        // Table section header with accent
        let startY = 40;

        // Section header background
        doc.setFillColor(BG_SECTION.r, BG_SECTION.g, BG_SECTION.b);
        doc.roundedRect(margin, startY - 6, contentWidth, 14, 2, 2, 'F');

        // Accent indicator
        doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.circle(margin + 5, startY + 1, 2, 'F');

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
        doc.text(table.name, margin + 12, startY + 2);

        // Contact count badge
        doc.setFontSize(9);
        const countText = `${tableContacts.length}`;
        const countBadgeX = pageWidth - margin - 20;
        doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
        doc.roundedRect(countBadgeX, startY - 3, 16, 8, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(countText, countBadgeX + 8 - doc.getTextWidth(countText) / 2, startY + 2);

        startY += 14;

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

        // Generate table with styled headers
        autoTable(doc, {
            head: [headers],
            body: body,
            startY: startY,
            margin: { left: margin, right: margin },
            styles: {
                fontSize: 9,
                cellPadding: 4,
                lineColor: [BORDER_LIGHT.r, BORDER_LIGHT.g, BORDER_LIGHT.b],
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: [BG_HEADER.r, BG_HEADER.g, BG_HEADER.b],
                textColor: [ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b],
                fontStyle: 'bold',
                fontSize: 9,
            },
            alternateRowStyles: {
                fillColor: [BG_ALTERNATE.r, BG_ALTERNATE.g, BG_ALTERNATE.b],
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

            // Summary card with accent
            const summaryCardHeight = 16;
            doc.setFillColor(BG_HEADER.r, BG_HEADER.g, BG_HEADER.b);
            doc.roundedRect(margin, summaryY - 4, contentWidth, summaryCardHeight, 2, 2, 'F');

            // Left accent
            doc.setFillColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
            doc.roundedRect(margin, summaryY - 4, 3, summaryCardHeight, 2, 0, 'F');
            doc.rect(margin + 1, summaryY - 4, 2, summaryCardHeight, 'F');

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
            doc.text('Summary', margin + 8, summaryY + 3);

            // Total with accent
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
            doc.text(`${grandTotal}`, margin + 50, summaryY + 3);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(TEXT_SECONDARY.r, TEXT_SECONDARY.g, TEXT_SECONDARY.b);
            doc.text(' total', margin + 50 + doc.getTextWidth(`${grandTotal}`), summaryY + 3);

            // Metric totals
            let metricX = margin + 50 + doc.getTextWidth(`${grandTotal} total`) + 15;
            metrics.forEach(metric => {
                const metricText = `${metric.name}: ${metricTotals[metric.name]}`;
                doc.text(metricText, metricX, summaryY + 3);
                metricX += doc.getTextWidth(metricText) + 15;
            });
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
