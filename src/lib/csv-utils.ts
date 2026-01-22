import Papa from 'papaparse';
import { ColumnType } from '@/lib/db/types';

export interface ParsedCSV {
    headers: string[];
    rows: Record<string, string>[];
    detectedTypes: Record<string, ColumnType>;
}

export interface ColumnMapping {
    csvHeader: string;
    targetType: ColumnType;
    targetName: string;
}

// Header name patterns for type detection
const HEADER_PATTERNS: Record<ColumnType, RegExp[]> = {
    email: [/^e-?mail$/i, /email.?address/i, /^contact.?email$/i],
    phone: [/^phone$/i, /^mobile$/i, /^cell$/i, /phone.?number/i, /^tel$/i, /^telephone$/i],
    url: [/^url$/i, /^link$/i, /^website$/i, /^web$/i, /^site$/i],
    date: [/date$/i, /^created/i, /^updated/i, /^start/i, /^end/i, /^due/i, /^birthday/i, /^dob$/i],
    datetime: [/datetime/i, /timestamp/i],
    number: [/^amount$/i, /^count$/i, /^total$/i, /^quantity$/i, /^qty$/i, /^age$/i, /^score$/i, /^rating$/i, /^price$/i],
    currency: [/^price$/i, /^cost$/i, /^amount$/i, /^revenue$/i, /^salary$/i, /^payment$/i, /\$/],
    percentage: [/percent/i, /rate$/i, /ratio$/i, /%$/],
    checkbox: [/^active$/i, /^enabled$/i, /^is.?/i, /^has.?/i, /^completed$/i, /^done$/i],
    status: [/^status$/i, /^state$/i, /^stage$/i, /^phase$/i],
    select: [/^type$/i, /^category$/i, /^department$/i, /^role$/i, /^level$/i],
    // These won't be auto-detected from headers
    text: [],
    multi_select: [],
    person: [],
    rating: [],
    relationship: [],
};

// Value patterns for type detection
const VALUE_PATTERNS = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[\d\s\-\+\(\)\.]{7,20}$/,
    url: /^(https?:\/\/|www\.)/i,
    date: /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})$/,
    datetime: /^\d{4}[-/]\d{1,2}[-/]\d{1,2}[T\s]\d{1,2}:\d{2}/,
    number: /^-?[\d,]+\.?\d*$/,
    currency: /^[$€£¥][\d,]+\.?\d*$|^[\d,]+\.?\d*[$€£¥]$/,
    percentage: /^-?\d+\.?\d*%$/,
    checkbox: /^(true|false|yes|no|1|0|y|n)$/i,
};

/**
 * Detect column type from header name
 */
function detectTypeFromHeader(header: string): ColumnType | null {
    const normalizedHeader = header.toLowerCase().trim();

    for (const [type, patterns] of Object.entries(HEADER_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(normalizedHeader)) {
                return type as ColumnType;
            }
        }
    }

    return null;
}

/**
 * Detect column type from sample values
 */
function detectTypeFromValues(values: string[]): ColumnType {
    const nonEmpty = values.filter(v => v && v.trim() !== '');

    if (nonEmpty.length === 0) return 'text';

    // Check each pattern in order of specificity
    const checks: Array<{ type: ColumnType; pattern: RegExp; threshold: number }> = [
        { type: 'email', pattern: VALUE_PATTERNS.email, threshold: 0.8 },
        { type: 'url', pattern: VALUE_PATTERNS.url, threshold: 0.8 },
        { type: 'datetime', pattern: VALUE_PATTERNS.datetime, threshold: 0.7 },
        { type: 'date', pattern: VALUE_PATTERNS.date, threshold: 0.7 },
        { type: 'currency', pattern: VALUE_PATTERNS.currency, threshold: 0.7 },
        { type: 'percentage', pattern: VALUE_PATTERNS.percentage, threshold: 0.7 },
        { type: 'checkbox', pattern: VALUE_PATTERNS.checkbox, threshold: 0.9 },
        { type: 'phone', pattern: VALUE_PATTERNS.phone, threshold: 0.6 },
        { type: 'number', pattern: VALUE_PATTERNS.number, threshold: 0.8 },
    ];

    for (const { type, pattern, threshold } of checks) {
        const matches = nonEmpty.filter(v => pattern.test(v.trim()));
        if (matches.length / nonEmpty.length >= threshold) {
            return type;
        }
    }

    // Check if it could be a select (limited unique values)
    const uniqueValues = new Set(nonEmpty.map(v => v.trim().toLowerCase()));
    if (uniqueValues.size <= 6 && nonEmpty.length >= 5) {
        return 'select';
    }

    return 'text';
}

/**
 * Detect column type using both header and values
 */
export function detectColumnType(header: string, values: string[]): ColumnType {
    // First try header-based detection
    const headerType = detectTypeFromHeader(header);
    if (headerType) {
        return headerType;
    }

    // Fall back to value-based detection
    return detectTypeFromValues(values);
}

/**
 * Parse CSV file and detect column types
 */
export function parseCSV(file: File): Promise<ParsedCSV> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const headers = results.meta.fields || [];
                const rows = results.data as Record<string, string>[];

                // Detect types for each column
                const detectedTypes: Record<string, ColumnType> = {};
                const sampleSize = Math.min(100, rows.length);

                for (const header of headers) {
                    const sampleValues = rows.slice(0, sampleSize).map(row => row[header] || '');
                    detectedTypes[header] = detectColumnType(header, sampleValues);
                }

                resolve({ headers, rows, detectedTypes });
            },
            error: (error) => {
                reject(new Error(`Failed to parse CSV: ${error.message}`));
            },
        });
    });
}

/**
 * Parse CSV string (for testing or pasted data)
 */
export function parseCSVString(csvString: string): ParsedCSV {
    const results = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
    });

    const headers = results.meta.fields || [];
    const rows = results.data as Record<string, string>[];

    const detectedTypes: Record<string, ColumnType> = {};
    const sampleSize = Math.min(100, rows.length);

    for (const header of headers) {
        const sampleValues = rows.slice(0, sampleSize).map(row => row[header] || '');
        detectedTypes[header] = detectColumnType(header, sampleValues);
    }

    return { headers, rows, detectedTypes };
}

/**
 * Transform CSV row data to match column types
 */
export function transformValue(value: string, targetType: ColumnType): any {
    if (!value || value.trim() === '') return null;

    const trimmed = value.trim();

    switch (targetType) {
        case 'number':
            const num = parseFloat(trimmed.replace(/,/g, ''));
            return isNaN(num) ? null : num;

        case 'currency':
            const currency = parseFloat(trimmed.replace(/[$€£¥,]/g, ''));
            return isNaN(currency) ? null : currency;

        case 'percentage':
            const pct = parseFloat(trimmed.replace(/%/g, ''));
            return isNaN(pct) ? null : pct;

        case 'checkbox':
            const lower = trimmed.toLowerCase();
            return ['true', 'yes', '1', 'y'].includes(lower);

        case 'date':
        case 'datetime':
            // Try to parse as ISO date
            const date = new Date(trimmed);
            return isNaN(date.getTime()) ? trimmed : date.toISOString().split('T')[0];

        case 'rating':
            const rating = parseInt(trimmed, 10);
            return isNaN(rating) ? null : Math.min(5, Math.max(1, rating));

        case 'phone':
            return formatPhoneNumber(trimmed);

        default:
            return trimmed;
    }
}

/**
 * Format phone number to (XXX) XXX-XXXX format for US/Canada numbers
 */
function formatPhoneNumber(input: string): string {
    if (!input) return '';

    // Extract only digits
    let digits = input.replace(/\D/g, '');

    if (digits.length === 0) return input; // Return original if no digits

    // Strip leading 1 for US numbers
    if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
    }

    // US/Canada format (10 digits): (XXX) XXX-XXXX
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // International or other formats
    if (digits.length > 10) {
        return '+' + digits.replace(/(\d{1,3})(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4').trim();
    }

    // Partial numbers - return original
    return input;
}

/**
 * Get display name for column type
 */
export function getColumnTypeLabel(type: ColumnType): string {
    const labels: Record<ColumnType, string> = {
        text: 'Text',
        number: 'Number',
        email: 'Email',
        phone: 'Phone',
        url: 'URL',
        date: 'Date',
        datetime: 'Date & Time',
        checkbox: 'Checkbox',
        select: 'Select',
        multi_select: 'Multi-select',
        status: 'Status',
        person: 'Person',
        currency: 'Currency',
        percentage: 'Percentage',
        rating: 'Rating',
        relationship: 'Relationship',
    };
    return labels[type] || type;
}

/**
 * Get available column types for import
 */
export function getImportableColumnTypes(): ColumnType[] {
    return [
        'text',
        'number',
        'email',
        'phone',
        'url',
        'date',
        'checkbox',
        'select',
        'status',
        'currency',
        'percentage',
    ];
}
