'use client';

import { useState, useRef, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ColumnType } from '@/lib/db/types';
import {
    parseCSV,
    ParsedCSV,
    getColumnTypeLabel,
    getImportableColumnTypes,
    transformValue,
} from '@/lib/csv-utils';
import {
    Upload,
    FileSpreadsheet,
    AlertCircle,
    CheckCircle2,
    ArrowLeft,
    ArrowRight,
    Loader2,
} from 'lucide-react';

type Step = 'upload' | 'mapping' | 'preview';

interface ColumnConfig {
    csvHeader: string;
    name: string;
    type: ColumnType;
    include: boolean;
}

interface ImportCSVDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tableId: string;
    tableName: string;
    onImportComplete: () => void;
}

export function ImportCSVDialog({
    open,
    onOpenChange,
    tableId,
    tableName,
    onImportComplete,
}: ImportCSVDialogProps) {
    const [step, setStep] = useState<Step>('upload');
    const [parsedData, setParsedData] = useState<ParsedCSV | null>(null);
    const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([]);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setStep('upload');
        setParsedData(null);
        setColumnConfigs([]);
        setImporting(false);
        setError(null);
    };

    const handleClose = (isOpen: boolean) => {
        if (!isOpen) {
            resetState();
        }
        onOpenChange(isOpen);
    };

    const handleFileSelect = useCallback(async (file: File) => {
        if (!file.name.endsWith('.csv')) {
            setError('Please select a CSV file');
            return;
        }

        setError(null);

        try {
            const data = await parseCSV(file);

            if (data.headers.length === 0) {
                setError('CSV file appears to be empty or has no headers');
                return;
            }

            setParsedData(data);

            // Initialize column configs with detected types
            const configs: ColumnConfig[] = data.headers.map((header) => ({
                csvHeader: header,
                name: header,
                type: data.detectedTypes[header],
                include: true,
            }));

            setColumnConfigs(configs);
            setStep('mapping');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to parse CSV');
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    }, []);

    const updateColumnConfig = (index: number, updates: Partial<ColumnConfig>) => {
        setColumnConfigs((prev) =>
            prev.map((config, i) => (i === index ? { ...config, ...updates } : config))
        );
    };

    const handleImport = async () => {
        if (!parsedData) return;

        const includedColumns = columnConfigs.filter((c) => c.include);
        if (includedColumns.length === 0) {
            setError('Please include at least one column');
            return;
        }

        setImporting(true);
        setError(null);

        try {
            // First, create columns for the table
            for (const col of includedColumns) {
                await fetch(`/api/data-tables/${tableId}/columns`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: col.name,
                        type: col.type,
                    }),
                });
            }

            // Fetch the created columns to get their IDs
            const tableResponse = await fetch(`/api/data-tables/${tableId}`);
            const tableData = await tableResponse.json();
            const createdColumns = tableData.table?.columns || [];

            // Create a mapping from column name to column ID
            const columnNameToId: Record<string, string> = {};
            for (const col of createdColumns) {
                columnNameToId[col.name] = col.id;
            }

            // Transform and insert rows
            for (const row of parsedData.rows) {
                const rowData: Record<string, any> = {};

                for (const col of includedColumns) {
                    const columnId = columnNameToId[col.name];
                    if (columnId) {
                        const rawValue = row[col.csvHeader];
                        rowData[columnId] = transformValue(rawValue, col.type);
                    }
                }

                await fetch(`/api/data-tables/${tableId}/rows`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: rowData }),
                });
            }

            onImportComplete();
            handleClose(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import data');
        } finally {
            setImporting(false);
        }
    };

    const includedCount = columnConfigs.filter((c) => c.include).length;
    const rowCount = parsedData?.rows.length || 0;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'upload' && 'Import CSV'}
                        {step === 'mapping' && 'Configure Columns'}
                        {step === 'preview' && 'Preview Import'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'upload' && `Import data from a CSV file into "${tableName}"`}
                        {step === 'mapping' && 'Review detected types and rename columns as needed'}
                        {step === 'preview' && `Ready to import ${rowCount} rows with ${includedCount} columns`}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto px-4 py-4">
                    {/* Step 1: Upload */}
                    {step === 'upload' && (
                        <div className="space-y-4">
                            <div
                                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                    dragOver
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/50'
                                }`}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileSelect(file);
                                    }}
                                />

                                <div className="flex flex-col items-center gap-3">
                                    <div className="rounded-full bg-muted p-4">
                                        <Upload className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Drop your CSV file here</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            or click to browse
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                                        Select CSV File
                                    </Button>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="text-xs text-muted-foreground space-y-1">
                                <p>Supported format: CSV (comma-separated values)</p>
                                <p>First row should contain column headers</p>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Column Mapping */}
                    {step === 'mapping' && parsedData && (
                        <div className="space-y-4">
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="px-3 py-2 text-left w-12">Include</th>
                                            <th className="px-3 py-2 text-left">CSV Column</th>
                                            <th className="px-3 py-2 text-left">Name</th>
                                            <th className="px-3 py-2 text-left">Type</th>
                                            <th className="px-3 py-2 text-left">Sample</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {columnConfigs.map((config, index) => (
                                            <tr
                                                key={config.csvHeader}
                                                className={!config.include ? 'opacity-50' : ''}
                                            >
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.include}
                                                        onChange={(e) =>
                                                            updateColumnConfig(index, {
                                                                include: e.target.checked,
                                                            })
                                                        }
                                                        className="rounded"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                                    {config.csvHeader}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        value={config.name}
                                                        onChange={(e) =>
                                                            updateColumnConfig(index, {
                                                                name: e.target.value,
                                                            })
                                                        }
                                                        className="h-8 text-sm"
                                                        disabled={!config.include}
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Select
                                                        value={config.type}
                                                        onValueChange={(value) =>
                                                            updateColumnConfig(index, {
                                                                type: value as ColumnType,
                                                            })
                                                        }
                                                        disabled={!config.include}
                                                    >
                                                        <SelectTrigger className="h-8 text-sm w-32">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {getImportableColumnTypes().map((type) => (
                                                                <SelectItem key={type} value={type}>
                                                                    {getColumnTypeLabel(type)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[150px]">
                                                    {parsedData.rows[0]?.[config.csvHeader] || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Preview */}
                    {step === 'preview' && parsedData && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm bg-green-500/10 text-green-700 p-3 rounded-lg">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                Ready to import {rowCount} rows with {includedCount} columns
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <div className="text-xs font-medium px-3 py-2 bg-muted/50 border-b">
                                    Preview (first 5 rows)
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/30">
                                            <tr>
                                                {columnConfigs
                                                    .filter((c) => c.include)
                                                    .map((config) => (
                                                        <th
                                                            key={config.csvHeader}
                                                            className="px-3 py-2 text-left font-medium"
                                                        >
                                                            <div>{config.name}</div>
                                                            <div className="text-[10px] font-normal text-muted-foreground">
                                                                {getColumnTypeLabel(config.type)}
                                                            </div>
                                                        </th>
                                                    ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {parsedData.rows.slice(0, 5).map((row, rowIndex) => (
                                                <tr key={rowIndex}>
                                                    {columnConfigs
                                                        .filter((c) => c.include)
                                                        .map((config) => (
                                                            <td
                                                                key={config.csvHeader}
                                                                className="px-3 py-2 truncate max-w-[200px]"
                                                            >
                                                                {row[config.csvHeader] || '-'}
                                                            </td>
                                                        ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {rowCount > 5 && (
                                <p className="text-xs text-muted-foreground text-center">
                                    ...and {rowCount - 5} more rows
                                </p>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer with navigation */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                        {step !== 'upload' && (
                            <Button
                                variant="ghost"
                                onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
                                disabled={importing}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => handleClose(false)} disabled={importing}>
                            Cancel
                        </Button>
                        {step === 'mapping' && (
                            <Button
                                onClick={() => {
                                    if (includedCount === 0) {
                                        setError('Please include at least one column');
                                        return;
                                    }
                                    setError(null);
                                    setStep('preview');
                                }}
                            >
                                Next
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        )}
                        {step === 'preview' && (
                            <Button onClick={handleImport} disabled={importing}>
                                {importing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>Import {rowCount} Rows</>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
