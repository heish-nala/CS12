'use client';

import { useState, useEffect } from 'react';
import { Client } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Mail, User, Calendar, Trash2, Plus, BarChart3, Activity, Archive, ArchiveRestore } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useClients } from '@/contexts/clients-context';
import { useRouter } from 'next/navigation';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DataColumn } from '@/lib/db/types';

interface ClientSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    client: Client | null;
    onUpdate?: () => void;
    onOpenMetricsDialog?: () => void;
}

export function ClientSettingsDialog({
    open,
    onOpenChange,
    client,
    onUpdate,
    onOpenMetricsDialog,
}: ClientSettingsDialogProps) {
    const { user } = useAuth();
    const { refreshClients } = useClients();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        industry: '',
        contact_name: '',
        contact_email: '',
    });
    const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);

    // Activity contact source configuration
    const [dataTableColumns, setDataTableColumns] = useState<DataColumn[]>([]);
    const [dataTableId, setDataTableId] = useState<string>('');
    const [dataTableName, setDataTableName] = useState<string>('');
    const [activityConfig, setActivityConfig] = useState({
        nameColumnId: '',
        emailColumnId: '',
        phoneColumnId: '',
    });
    const [loadingTable, setLoadingTable] = useState(false);

    useEffect(() => {
        if (client && open) {
            setFormData({
                name: client.name || '',
                industry: client.industry || '',
                contact_name: client.contact_name || '',
                contact_email: client.contact_email || '',
            });

            // Load saved activity config from localStorage
            const savedConfig = localStorage.getItem(`activity-contact-source-${client.id}`);
            if (savedConfig) {
                try {
                    const config = JSON.parse(savedConfig);
                    setActivityConfig({
                        nameColumnId: config.nameColumnId || '',
                        emailColumnId: config.emailColumnId || '',
                        phoneColumnId: config.phoneColumnId || '',
                    });
                } catch {
                    // Ignore parse errors
                }
            }

            // Fetch data table for this client
            fetchDataTable(client.id);
        }
    }, [client, open]);

    const fetchDataTable = async (clientId: string) => {
        setLoadingTable(true);
        try {
            const userIdParam = user?.id ? `&user_id=${user.id}` : '';
            const response = await fetch(`/api/data-tables?client_id=${clientId}${userIdParam}`);
            if (response.ok) {
                const { tables } = await response.json();
                // Use the first (and typically only) table
                if (tables && tables.length > 0) {
                    const table = tables[0];
                    setDataTableId(table.id);
                    setDataTableName(table.name);
                    setDataTableColumns(table.columns || []);
                }
            }
        } catch (error) {
            console.error('Error fetching data table:', error);
        } finally {
            setLoadingTable(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!client) return;

        setLoading(true);

        try {
            // TODO: Replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            toast.success('Client settings updated successfully');
            onUpdate?.();
            onOpenChange(false);
        } catch (error) {
            console.error('Error updating client:', error);
            toast.error('Failed to update client settings');
        } finally {
            setLoading(false);
        }
    };

    const saveActivityConfig = () => {
        if (!client || !dataTableId) return;

        const config = {
            tableId: dataTableId,
            tableName: dataTableName,
            nameColumnId: activityConfig.nameColumnId,
            emailColumnId: activityConfig.emailColumnId && activityConfig.emailColumnId !== '__none__' ? activityConfig.emailColumnId : undefined,
            phoneColumnId: activityConfig.phoneColumnId && activityConfig.phoneColumnId !== '__none__' ? activityConfig.phoneColumnId : undefined,
        };

        localStorage.setItem(`activity-contact-source-${client.id}`, JSON.stringify(config));
        toast.success('Activity contact source saved');
    };

    const handleArchiveToggle = async () => {
        if (!client || !user?.id) return;

        setArchiving(true);
        try {
            const response = await fetch('/api/dsos', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: client.id,
                    user_id: user.id,
                    archived: !client.archived,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update client');
            }

            toast.success(client.archived ? 'Client restored' : 'Client archived');
            onOpenChange(false);
            onUpdate?.();

            // Refresh the sidebar clients list
            refreshClients();

            // Redirect to home if archiving
            if (!client.archived) {
                router.push('/');
            }
        } catch (error) {
            console.error('Error archiving client:', error);
            toast.error('Failed to update client');
        } finally {
            setArchiving(false);
        }
    };

    const addCustomField = () => {
        setCustomFields([...customFields, { key: '', value: '' }]);
    };

    const removeCustomField = (index: number) => {
        setCustomFields(customFields.filter((_, i) => i !== index));
    };

    const updateCustomField = (index: number, field: 'key' | 'value', value: string) => {
        const updated = [...customFields];
        updated[index][field] = value;
        setCustomFields(updated);
    };

    if (!client) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Client Settings</DialogTitle>
                    <DialogDescription>
                        Manage {client.name}'s information and configuration
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="p-4 pt-4">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="contact">Contact</TabsTrigger>
                        <TabsTrigger value="activity">Activity</TabsTrigger>
                        <TabsTrigger value="metrics">Metrics</TabsTrigger>
                        <TabsTrigger value="custom">Custom</TabsTrigger>
                    </TabsList>

                    <form onSubmit={handleSubmit}>
                        <TabsContent value="general" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="client-name">
                                    <Building2 className="h-4 w-4 inline mr-2" />
                                    Client Name *
                                </Label>
                                <Input
                                    id="client-name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Acme Dental Group"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="industry">Industry / Type</Label>
                                <Input
                                    id="industry"
                                    value={formData.industry}
                                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                    placeholder="e.g., Dental Services, Healthcare"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Client Since</Label>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    {new Date(client.created_at).toLocaleDateString('en-US', {
                                        month: 'long',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Client ID</Label>
                                <div className="flex items-center gap-2">
                                    <code className="text-xs bg-muted px-2 py-1 rounded">{client.id}</code>
                                    <Badge variant="outline" className="text-xs">Read-only</Badge>
                                </div>
                            </div>

                            {/* Archive Section */}
                            <div className="pt-4 mt-4 border-t">
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">
                                        {client.archived ? 'Restore Client' : 'Archive Client'}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        {client.archived
                                            ? 'Restore this client to make it active again in your workspace.'
                                            : 'Archive this client to hide it from your workspace. You can restore it later.'}
                                    </p>
                                    <Button
                                        type="button"
                                        variant={client.archived ? 'default' : 'outline'}
                                        onClick={handleArchiveToggle}
                                        disabled={archiving}
                                        className="w-full mt-2"
                                    >
                                        {archiving ? (
                                            'Processing...'
                                        ) : client.archived ? (
                                            <>
                                                <ArchiveRestore className="h-4 w-4 mr-2" />
                                                Restore Client
                                            </>
                                        ) : (
                                            <>
                                                <Archive className="h-4 w-4 mr-2" />
                                                Archive Client
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="contact" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="contact-name">
                                    <User className="h-4 w-4 inline mr-2" />
                                    Primary Contact Name
                                </Label>
                                <Input
                                    id="contact-name"
                                    value={formData.contact_name}
                                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                    placeholder="e.g., John Smith"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="contact-email">
                                    <Mail className="h-4 w-4 inline mr-2" />
                                    Contact Email
                                </Label>
                                <Input
                                    id="contact-email"
                                    type="email"
                                    value={formData.contact_email}
                                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                    placeholder="john@example.com"
                                />
                            </div>

                            <div className="rounded-lg border p-4 bg-muted/50">
                                <p className="text-sm text-muted-foreground">
                                    <strong>Tip:</strong> The primary contact will receive important notifications
                                    and updates about their program.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="activity" className="space-y-4 mt-4">
                            <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/50">
                                <Activity className="h-5 w-5 mt-0.5 text-muted-foreground" />
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium">Activity Contact Source</p>
                                    <p className="text-sm text-muted-foreground">
                                        Configure which columns from your data table contain contact information for activity logging.
                                    </p>
                                </div>
                            </div>

                            {loadingTable ? (
                                <div className="py-8 text-center text-sm text-muted-foreground">
                                    Loading data table...
                                </div>
                            ) : !dataTableId ? (
                                <div className="py-8 text-center text-sm text-muted-foreground">
                                    No data table found. Create a data table first to configure activity contacts.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-sm text-muted-foreground">
                                        Using table: <span className="font-medium text-foreground">{dataTableName}</span>
                                    </div>

                                    <div className="space-y-3 p-4 rounded-lg border">
                                        <div className="space-y-2">
                                            <Label>Name Column *</Label>
                                            <Select
                                                value={activityConfig.nameColumnId}
                                                onValueChange={(value) => setActivityConfig({ ...activityConfig, nameColumnId: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select the name column..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {dataTableColumns.map((col) => (
                                                        <SelectItem key={col.id} value={col.id}>
                                                            {col.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label>Email Column</Label>
                                                <Select
                                                    value={activityConfig.emailColumnId}
                                                    onValueChange={(value) => setActivityConfig({ ...activityConfig, emailColumnId: value })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Optional" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">None</SelectItem>
                                                        {dataTableColumns
                                                            .filter(col => col.type === 'email' || col.type === 'text')
                                                            .map((col) => (
                                                                <SelectItem key={col.id} value={col.id}>
                                                                    {col.name}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Phone Column</Label>
                                                <Select
                                                    value={activityConfig.phoneColumnId}
                                                    onValueChange={(value) => setActivityConfig({ ...activityConfig, phoneColumnId: value })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Optional" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">None</SelectItem>
                                                        {dataTableColumns
                                                            .filter(col => col.type === 'phone' || col.type === 'text')
                                                            .map((col) => (
                                                                <SelectItem key={col.id} value={col.id}>
                                                                    {col.name}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        onClick={saveActivityConfig}
                                        disabled={!activityConfig.nameColumnId}
                                        className="w-full"
                                    >
                                        Save Contact Source
                                    </Button>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="metrics" className="space-y-4 mt-4">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/50">
                                    <BarChart3 className="h-5 w-5 mt-0.5 text-muted-foreground" />
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium">
                                            Configure Metrics & Analytics
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Choose which metrics to track and display for this client.
                                            Metrics appear on the overview dashboard and members page.
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    type="button"
                                    variant="default"
                                    onClick={onOpenMetricsDialog}
                                    className="w-full"
                                >
                                    <BarChart3 className="h-4 w-4 mr-2" />
                                    Configure Metrics
                                </Button>

                                <div className="rounded-lg border p-4 bg-muted/50">
                                    <p className="text-sm text-muted-foreground">
                                        Choose from industry bundles (Healthcare, Sales, Franchise, Education, SaaS)
                                        or create your own custom metric configuration.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="custom" className="space-y-4 mt-4">
                            <div className="space-y-3">
                                {customFields.length === 0 ? (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        No custom fields yet. Add fields to track additional information.
                                    </div>
                                ) : (
                                    customFields.map((field, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                placeholder="Field name"
                                                value={field.key}
                                                onChange={(e) => updateCustomField(index, 'key', e.target.value)}
                                                className="flex-1"
                                            />
                                            <Input
                                                placeholder="Value"
                                                value={field.value}
                                                onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                                                className="flex-1"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeCustomField(index)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addCustomField}
                                className="w-full"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Custom Field
                            </Button>

                            <div className="rounded-lg border p-4 bg-muted/50">
                                <p className="text-sm text-muted-foreground">
                                    Custom fields allow you to track additional client-specific information
                                    like territory, account manager, contract type, etc.
                                </p>
                            </div>
                        </TabsContent>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
