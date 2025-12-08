import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DataColumn, DataRow, PeriodData, TimeTrackingConfig, StatusOption } from '@/lib/db/types';

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
    const monthName = MONTHS[selectedMonth];

    // Header function for each page
    const addHeader = (pageNumber: number, totalPages: number) => {
        // Title
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text(tableName, margin, 20);

        // Subtitle with month and date
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(`${monthName} ${year} Report`, margin, 28);

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
        doc.text('CS12 - Attendee Tracker Report', margin, pageHeight - 10);
    };

    // Calculate table data
    const primaryColumn = columns.find(c => c.is_primary) || columns[0];
    const otherColumns = columns.filter(c => c.id !== primaryColumn?.id);

    // Build table headers
    const headers: string[] = [];
    if (primaryColumn) headers.push(primaryColumn.name);
    otherColumns.forEach(col => headers.push(col.name));

    // Add time tracking metric headers if enabled
    if (timeTracking?.enabled) {
        timeTracking.metrics.forEach(metric => {
            headers.push(`${monthName} ${metric.name}`);
        });
        headers.push('YTD Total');
    }

    // Build table body
    const body: (string | { content: string; styles?: any })[][] = rows.map(row => {
        const rowData: (string | { content: string; styles?: any })[] = [];

        // Primary column
        if (primaryColumn) {
            rowData.push(formatCellValue(primaryColumn, row.data[primaryColumn.id]));
        }

        // Other columns
        otherColumns.forEach(col => {
            const value = row.data[col.id];

            if (col.type === 'status') {
                const color = getStatusColor(col, value);
                rowData.push({
                    content: formatCellValue(col, value),
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
                    content: formatCellValue(col, value),
                    styles: {
                        textColor: textColor,
                        fontStyle: 'bold',
                    }
                });
            } else {
                rowData.push(formatCellValue(col, value));
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

                // Calculate YTD for first metric only
                if (metric.id === timeTracking.metrics[0].id) {
                    ytdTotal = periods.reduce((sum, p) => {
                        const periodStart = new Date(p.period_start);
                        if (periodStart.getMonth() <= selectedMonth && periodStart.getFullYear() === year) {
                            return sum + (p.metrics[metric.id] || 0);
                        }
                        return sum;
                    }, 0);
                }
            });
            rowData.push(ytdTotal.toString());
        }

        return rowData;
    });

    // Calculate column widths
    const availableWidth = pageWidth - (margin * 2);
    const numColumns = headers.length;
    const colWidths = headers.map((_, index) => {
        if (index === 0) return availableWidth * 0.15; // Primary column
        if (headers[index].includes('Status')) return availableWidth * 0.08;
        if (headers[index].includes('YTD')) return availableWidth * 0.08;
        return availableWidth / numColumns;
    });

    // Generate table
    let startY = 40;

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
        didDrawPage: (data) => {
            // Reset startY for subsequent pages
            if (data.pageNumber > 1) {
                startY = 40;
            }
        },
        willDrawCell: (data) => {
            // Handle custom cell styling from body data
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
        },
    });

    // Calculate total pages and add headers/footers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addHeader(i, totalPages);
        addFooter();
    }

    // Add summary section on last page if there's room, otherwise new page
    const finalY = (doc as any).lastAutoTable?.finalY || startY;
    let summaryY = finalY + 15;

    if (summaryY > pageHeight - 50) {
        doc.addPage();
        summaryY = 40;
        addHeader(totalPages + 1, totalPages + 1);
        addFooter();
    }

    // Summary section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Summary', margin, summaryY);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);

    const summaryItems = [
        `Total Attendees: ${rows.length}`,
        `Report Period: ${monthName} ${year}`,
    ];

    // Add time tracking summary if enabled
    if (timeTracking?.enabled) {
        timeTracking.metrics.forEach(metric => {
            let total = 0;
            let ytdTotal = 0;

            rows.forEach(row => {
                const periods = periodData[row.id] || [];
                const monthPeriod = periods.find(p => {
                    const periodStart = new Date(p.period_start);
                    return periodStart.getMonth() === selectedMonth;
                });
                total += monthPeriod?.metrics[metric.id] || 0;

                // YTD calculation
                periods.forEach(p => {
                    const periodStart = new Date(p.period_start);
                    if (periodStart.getMonth() <= selectedMonth && periodStart.getFullYear() === year) {
                        ytdTotal += p.metrics[metric.id] || 0;
                    }
                });
            });

            summaryItems.push(`Total ${metric.name} (${monthName}): ${total}`);
            summaryItems.push(`Total ${metric.name} (YTD): ${ytdTotal}`);
        });
    }

    summaryItems.forEach((item, index) => {
        doc.text(`• ${item}`, margin + 5, summaryY + 10 + (index * 7));
    });

    // Save the PDF
    const fileName = `${tableName.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`;
    doc.save(fileName);
}
