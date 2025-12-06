'use client';

import { useState, useEffect } from 'react';
import { TimeTrackingConfig, TimeTrackingFrequency, TimeTrackingMetric } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    BarChart3,
    Plus,
    X,
    GripVertical,
    Hash,
    DollarSign,
    Percent,
    AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const generateId = () => Math.random().toString(36).substring(2, 9);

const METRIC_TYPES: { value: TimeTrackingMetric['type']; label: string; icon: React.ReactNode }[] = [
    { value: 'number', label: 'Number', icon: <Hash className="h-4 w-4" /> },
    { value: 'currency', label: 'Currency', icon: <DollarSign className="h-4 w-4" /> },
    { value: 'percentage', label: 'Percentage', icon: <Percent className="h-4 w-4" /> },
];

const FREQUENCY_OPTIONS: { value: TimeTrackingFrequency; label: string; description: string }[] = [
    { value: 'weekly', label: 'Weekly', description: 'Track progress each week' },
    { value: 'monthly', label: 'Monthly', description: 'Track progress each month' },
    { value: 'quarterly', label: 'Quarterly', description: 'Track progress each quarter' },
];

// Metric Row Component
function MetricRow({
    metric,
    onUpdate,
    onDelete,
    canDelete,
}: {
    metric: TimeTrackingMetric;
    onUpdate: (updates: Partial<TimeTrackingMetric>) => void;
    onDelete: () => void;
    canDelete: boolean;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(metric.name);

    const handleSave = () => {
        if (editName.trim() && editName !== metric.name) {
            onUpdate({ name: editName.trim() });
        } else {
            setEditName(metric.name);
        }
        setIsEditing(false);
    };

    const typeConfig = METRIC_TYPES.find(t => t.value === metric.type) || METRIC_TYPES[0];

    return (
        <div className="group flex items-center gap-2 py-2 px-2 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
            <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />

            {isEditing ? (
                <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') {
                            setEditName(metric.name);
                            setIsEditing(false);
                        }
                    }}
                    className="h-8 flex-1 text-sm"
                    autoFocus
                />
            ) : (
                <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 text-left text-sm font-medium hover:text-primary transition-colors"
                >
                    {metric.name}
                </button>
            )}

            <Select
                value={metric.type}
                onValueChange={(value: TimeTrackingMetric['type']) => onUpdate({ type: value })}
            >
                <SelectTrigger className="w-[130px] h-8 text-sm">
                    <SelectValue>
                        <span className="flex items-center gap-1.5">
                            {typeConfig.icon}
                            {typeConfig.label}
                        </span>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {METRIC_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                            <span className="flex items-center gap-2">
                                {type.icon}
                                {type.label}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {canDelete && (
                <button
                    onClick={onDelete}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 transition-all text-muted-foreground hover:text-destructive"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

interface TimeTrackingConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    config: TimeTrackingConfig | null;
    onSave: (config: TimeTrackingConfig | null) => void;
    tableName: string;
}

export function TimeTrackingConfigDialog({
    open,
    onOpenChange,
    config,
    onSave,
    tableName,
}: TimeTrackingConfigDialogProps) {
    const [enabled, setEnabled] = useState(config?.enabled ?? false);
    const [frequency, setFrequency] = useState<TimeTrackingFrequency>(config?.frequency ?? 'monthly');
    const [metrics, setMetrics] = useState<TimeTrackingMetric[]>(
        config?.metrics ?? [
            { id: generateId(), name: 'Value', type: 'number' },
        ]
    );

    // Reset when dialog opens with new config
    useEffect(() => {
        if (open) {
            setEnabled(config?.enabled ?? false);
            setFrequency(config?.frequency ?? 'monthly');
            setMetrics(
                config?.metrics && config.metrics.length > 0
                    ? config.metrics
                    : [{ id: generateId(), name: 'Value', type: 'number' }]
            );
        }
    }, [open, config]);

    const handleAddMetric = () => {
        if (metrics.length >= 5) return;
        setMetrics(prev => [
            ...prev,
            { id: generateId(), name: `Metric ${prev.length + 1}`, type: 'number' },
        ]);
    };

    const handleUpdateMetric = (metricId: string, updates: Partial<TimeTrackingMetric>) => {
        setMetrics(prev => prev.map(m =>
            m.id === metricId ? { ...m, ...updates } : m
        ));
    };

    const handleDeleteMetric = (metricId: string) => {
        setMetrics(prev => prev.filter(m => m.id !== metricId));
    };

    const handleSave = () => {
        if (enabled) {
            onSave({
                enabled: true,
                frequency,
                metrics,
            });
        } else {
            onSave(null);
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                        Progress Tracking
                    </DialogTitle>
                    <DialogDescription>
                        Configure time-based progress tracking for &quot;{tableName}&quot;
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 p-4 pt-4">
                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                        <div className="space-y-0.5">
                            <Label htmlFor="enable-tracking" className="text-sm font-medium">
                                Enable Progress Tracking
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Track metrics over time for each row
                            </p>
                        </div>
                        <Switch
                            id="enable-tracking"
                            checked={enabled}
                            onCheckedChange={setEnabled}
                        />
                    </div>

                    {enabled && (
                        <>
                            {/* Frequency Selector */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Tracking Frequency</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {FREQUENCY_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => setFrequency(option.value)}
                                            className={cn(
                                                'p-3 rounded-lg border text-left transition-all',
                                                frequency === option.value
                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                    : 'hover:border-muted-foreground/30 hover:bg-muted/30'
                                            )}
                                        >
                                            <div className="text-sm font-medium">{option.label}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                {option.description}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Warning when frequency is changed */}
                                {config?.enabled && config?.frequency && frequency !== config.frequency && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                        <div className="text-xs">
                                            <p className="font-medium">Changing frequency will affect existing data</p>
                                            <p className="mt-0.5 text-amber-700">
                                                Your existing period data was recorded as {config.frequency}.
                                                Changing to {frequency} may cause data to display incorrectly.
                                                Consider keeping the current frequency or starting fresh.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Metrics Editor */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium">Metrics to Track</Label>
                                    <span className="text-xs text-muted-foreground">
                                        {metrics.length}/5
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {metrics.map((metric) => (
                                        <MetricRow
                                            key={metric.id}
                                            metric={metric}
                                            onUpdate={(updates) => handleUpdateMetric(metric.id, updates)}
                                            onDelete={() => handleDeleteMetric(metric.id)}
                                            canDelete={metrics.length > 1}
                                        />
                                    ))}
                                </div>

                                {metrics.length < 5 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddMetric}
                                        className="w-full"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Metric
                                    </Button>
                                )}

                                <p className="text-xs text-muted-foreground">
                                    Define what data you want to track for each row over time.
                                    For example: &quot;Calls Made&quot;, &quot;Revenue&quot;, or &quot;Completion Rate&quot;.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
