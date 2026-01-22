import { Doctor, Client, DSO, Activity, PeriodProgress, TaskGroup, Task, DataTable, DataColumn, DataRow, DataTemplate, ColumnType, PeriodData, TimeTrackingConfig, OverviewWidget, OverviewMetricCard, OverviewChartWidget, AggregationType } from './db/types';

// Empty arrays - no mock data
export const mockClients: Client[] = [];
export const mockDSOs: DSO[] = [];
export const mockDoctors: Doctor[] = [];
export const mockActivities: Activity[] = [];
export const mockPeriodProgress: PeriodProgress[] = [];
export const mockTaskGroups: TaskGroup[] = [];
export const mockTasks: Task[] = [];

// Helper functions that return empty results
export function getDoctorById(id: string) {
    return undefined;
}

export function getDoctorsByDSO(dsoId: string) {
    return [];
}

export function getDoctorsByStatus(status: string) {
    return [];
}

export function searchDoctors(searchTerm: string) {
    return [];
}

export function getPeriodProgressByDoctor(doctorId: string) {
    return [];
}

export function getActivitiesByDoctor(doctorId: string) {
    return [];
}

export function getLastActivityByDoctor(doctorId: string) {
    return null;
}

export function getDSOById(id: string) {
    return undefined;
}

export function getTasksByDoctor(doctorId: string) {
    return [];
}

export function getTasksByGroup(groupId: string) {
    return [];
}

export function getTasksByStatus(status: string) {
    return [];
}

export function getAllTasks() {
    return [];
}

export function getAllTaskGroups() {
    return [];
}

// ============================================================================
// DATA TABLE TEMPLATES - Keep these as they define table structures
// ============================================================================

// Single attendee list template - kept for reference and backward compatibility
export const mockDataTemplates: DataTemplate[] = [
    {
        id: 'attendee-tracker',
        name: 'Attendee Tracker',
        description: 'Track attendees with Name, Email, Phone, Blueprint progress, and Status',
        icon: 'users',
        color: 'blue',
        category: 'customer_success',
        columns: [
            { name: 'Name', type: 'text', is_primary: true, is_required: true },
            { name: 'Email', type: 'email' },
            { name: 'Phone', type: 'phone' },
            { name: 'Blueprint', type: 'percentage', config: { default_value: 0 } },
            { name: 'Status', type: 'status', config: { options: [
                { id: 's1', value: 'not_started', label: 'Not Started', color: 'gray', group: 'todo' },
                { id: 's2', value: 'active', label: 'Active', color: 'blue', group: 'in_progress' },
                { id: 's3', value: 'at_risk', label: 'At Risk', color: 'orange', group: 'in_progress' },
                { id: 's4', value: 'completed', label: 'Completed', color: 'green', group: 'complete' },
                { id: 's5', value: 'inactive', label: 'Inactive', color: 'red', group: 'complete' },
            ] } },
        ],
        time_tracking: {
            enabled: true,
            frequency: 'monthly',
            metrics: [
                { name: 'Scans', type: 'number' },
                { name: 'Accepted', type: 'number' },
                { name: 'Diagnosed', type: 'number' },
            ],
        },
        created_at: '2024-01-01T00:00:00Z',
    },
];

// Empty data stores - no pre-populated data
export const mockDataTables: DataTable[] = [];
export const mockDataColumns: DataColumn[] = [];
export const mockDataRows: DataRow[] = [];
export const mockPeriodData: PeriodData[] = [];
export let mockOverviewWidgets: OverviewWidget[] = [];

// Template helper functions
export function getTemplates(): DataTemplate[] {
    return mockDataTemplates;
}

export function getTemplateById(templateId: string): DataTemplate | undefined {
    return mockDataTemplates.find(t => t.id === templateId);
}

// Empty stub functions - these are no longer used but kept for compatibility
export function createDataTable(clientId: string, name: string, templateId?: string): DataTable {
    throw new Error('Use Supabase API instead');
}

export function createDataColumn(tableId: string, name: string, type: ColumnType, config?: any): DataColumn {
    throw new Error('Use Supabase API instead');
}

export function createDataRow(tableId: string, data: Record<string, any> = {}): DataRow {
    throw new Error('Use Supabase API instead');
}

export function updateDataRow(rowId: string, data: Record<string, any>): DataRow | null {
    throw new Error('Use Supabase API instead');
}

export function updateDataColumn(columnId: string, updates: Partial<DataColumn>): DataColumn | null {
    throw new Error('Use Supabase API instead');
}

export function deleteDataColumn(columnId: string): boolean {
    throw new Error('Use Supabase API instead');
}

export function deleteDataRow(rowId: string): boolean {
    throw new Error('Use Supabase API instead');
}

export function deleteDataTable(tableId: string): boolean {
    throw new Error('Use Supabase API instead');
}

export function getDataTablesByClient(clientId: string): DataTable[] {
    return [];
}

export function getDataTableById(tableId: string): DataTable | undefined {
    return undefined;
}

export function getColumnsByTable(tableId: string): DataColumn[] {
    return [];
}

export function getRowsByTable(tableId: string): DataRow[] {
    return [];
}

export function getPeriodDataByRow(tableId: string, rowId: string): PeriodData[] {
    return [];
}

export function getPeriodDataById(periodId: string): PeriodData | undefined {
    return undefined;
}

export function createPeriodData(
    tableId: string,
    rowId: string,
    periodStart: string,
    periodEnd: string,
    periodLabel: string,
    metrics: Record<string, number> = {}
): PeriodData {
    throw new Error('Use Supabase API instead');
}

export function updatePeriodData(periodId: string, metrics: Record<string, number>): PeriodData | null {
    throw new Error('Use Supabase API instead');
}

export function deletePeriodData(periodId: string): boolean {
    throw new Error('Use Supabase API instead');
}

export function clearPeriodsForTable(tableId: string): void {
    // No-op
}

export function initializePeriodsForRow(tableId: string, rowId: string, frequency: 'weekly' | 'monthly' | 'quarterly'): PeriodData[] {
    return [];
}

export function getCurrentPeriodLabel(frequency: 'weekly' | 'monthly' | 'quarterly'): string {
    const now = new Date();
    if (frequency === 'monthly') {
        return now.toLocaleDateString('en-US', { month: 'long' });
    } else if (frequency === 'weekly') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        return `Week ${weekNumber}`;
    } else {
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        return `Q${quarter} ${now.getFullYear()}`;
    }
}

// Overview widgets - empty
export function getOverviewWidgetsByClient(clientId: string): OverviewWidget[] {
    return [];
}

export function getOverviewWidgetById(widgetId: string): OverviewWidget | undefined {
    return undefined;
}

export function createOverviewWidget(
    clientId: string,
    type: 'metric_card' | 'chart',
    label: string,
    config: OverviewMetricCard['config'] | OverviewChartWidget['config']
): OverviewWidget {
    throw new Error('Use Supabase API instead');
}

export function updateOverviewWidget(
    widgetId: string,
    updates: Partial<Pick<OverviewWidget, 'label' | 'order_index' | 'config'>>
): OverviewWidget | null {
    throw new Error('Use Supabase API instead');
}

export function deleteOverviewWidget(widgetId: string): boolean {
    throw new Error('Use Supabase API instead');
}

export function reorderOverviewWidgets(clientId: string, widgetIds: string[]): void {
    // No-op
}

export function getAggregatableColumns(tableId: string): DataColumn[] {
    return [];
}

export function getChartableColumns(tableId: string): DataColumn[] {
    return [];
}

export function calculateAggregation(
    tableId: string,
    columnId: string,
    aggregation: AggregationType
): number | null {
    return null;
}

export function calculateChartData(
    tableId: string,
    columnId: string
): Array<{ label: string; value: number; color?: string }> {
    return [];
}
