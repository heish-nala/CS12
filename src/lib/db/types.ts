// Database Type Definitions
// Generated from Supabase schema

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type DoctorStatus = 'active' | 'inactive' | 'completed';
export type ActivityType = 'phone' | 'email' | 'text';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type UserRole = 'admin' | 'manager' | 'viewer';
export type CustomColumnType = 'text' | 'number' | 'percentage' | 'select' | 'date' | 'checkbox' | 'email' | 'phone' | 'url';

export interface CustomColumn {
    id: string;
    name: string;
    type: CustomColumnType;
    options?: string[]; // For select type
    width?: number;
    order_index: number;
}

export interface Client {
    id: string;
    name: string;
    industry?: string;
    contact_name?: string;
    contact_email?: string;
    archived?: boolean;
    created_at: string;
    updated_at: string;
}

// Legacy alias for backwards compatibility
export type DSO = Client;

export interface Doctor {
    id: string;
    dso_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    start_date: string;
    status: DoctorStatus;
    notes: string | null;
    created_at: string;
    updated_at: string;
    custom_fields?: Record<string, any>; // Flexible storage for custom column data
    // Computed fields (not in database)
    risk_level?: RiskLevel;
    days_since_activity?: number;
    total_cases?: number;
    total_courses?: number;
    course_progress_percent?: number;
}

export interface PeriodProgress {
    id: string;
    doctor_id: string;
    period_number: number;
    start_date: string;
    end_date: string;
    cases_submitted: number;
    courses_completed: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface Activity {
    id: string;
    client_id?: string;
    doctor_id?: string;
    activity_type: ActivityType;
    description: string;
    outcome?: 'positive' | 'neutral' | 'negative' | 'follow_up_needed';
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    created_by: string;
    created_at: string;
}

export interface TaskGroup {
    id: string;
    name: string;
    description: string | null;
    order_index: number;
    created_at: string;
}

export interface Task {
    id: string;
    task_group_id: string;
    doctor_id: string | null;
    title: string;
    description: string | null;
    status: TaskStatus;
    due_date: string | null;
    completed_at: string | null;
    order_index: number;
    created_at: string;
    updated_at: string;
}

export interface UserDSOAccess {
    id: string;
    user_id: string;
    dso_id: string;
    role: UserRole;
    created_at: string;
}

export interface DashboardMetricConfig {
    id: string;
    dso_id: string;
    metric_id: string;
    enabled: boolean;
    order_index: number;
    created_at: string;
    updated_at: string;
}

export interface ClientTerminology {
    id: string;
    dso_id: string;
    // Member/Unit terminology
    member_singular: string;
    member_plural: string;
    // Activity terminology
    activity_singular: string;
    activity_plural: string;
    // Primary metrics
    case_singular: string;
    case_plural: string;
    course_singular: string;
    course_plural: string;
    // Category names
    category_overview: string;
    category_engagement: string;
    category_performance: string;
    // Time period
    period_singular: string;
    period_plural: string;
    // Program/onboarding
    program_name: string;
    onboarding_name: string;
    created_at: string;
    updated_at: string;
}

export const DEFAULT_TERMINOLOGY: Omit<ClientTerminology, 'id' | 'dso_id' | 'created_at' | 'updated_at'> = {
    member_singular: 'doctor',
    member_plural: 'doctors',
    activity_singular: 'activity',
    activity_plural: 'activities',
    case_singular: 'case',
    case_plural: 'cases',
    course_singular: 'course',
    course_plural: 'courses',
    category_overview: 'Program Overview',
    category_engagement: 'Engagement & Activity',
    category_performance: 'Performance Metrics',
    period_singular: 'period',
    period_plural: 'periods',
    program_name: 'program',
    onboarding_name: 'onboarding',
};

// Extended types with relations
export interface DoctorWithDSO extends Doctor {
    dso: DSO;
}

export interface DoctorWithMetrics extends Doctor {
    period_progress: PeriodProgress[];
    activities: Activity[];
    last_activity?: Activity;
}

export interface TaskWithGroup extends Task {
    task_group: TaskGroup;
}

// API Response types
export interface DoctorListResponse {
    doctors: DoctorWithDSO[];
    total: number;
}

export interface DashboardMetrics {
    total_doctors: number;
    active_doctors: number;
    at_risk_count: number;
    critical_risk_count: number;
    total_cases_this_month: number;
    total_courses_this_month: number;
    risk_distribution: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
    // Customer Success Metrics
    average_days_in_program: number;
    engagement_rate: number; // % of doctors with activity in last 7 days
    avg_cases_per_doctor: number;
    avg_courses_per_doctor: number;
    doctors_needing_attention: number; // No activity in 14+ days
    recent_activities_count: number; // Last 7 days
    on_track_count: number; // Meeting or exceeding targets
    completion_rate: number; // % of doctors completing courses/cases on time
}

// Filter and sort types
export interface DoctorFilters {
    dso_id?: string;
    status?: DoctorStatus;
    risk_level?: RiskLevel;
    search?: string;
}

export interface DoctorSort {
    field: 'name' | 'start_date' | 'risk_level' | 'last_activity';
    direction: 'asc' | 'desc';
}

// ============================================================================
// FLEXIBLE DATA TABLES SYSTEM
// ============================================================================

export type ColumnType =
    | 'text'
    | 'number'
    | 'email'
    | 'phone'
    | 'url'
    | 'date'
    | 'datetime'
    | 'checkbox'
    | 'select'
    | 'multi_select'
    | 'status'
    | 'person'
    | 'currency'
    | 'percentage'
    | 'rating'
    | 'relationship';

// Notion-style color palette (10 colors)
export type StatusColor =
    | 'default'    // Light gray
    | 'gray'       // Dark gray
    | 'brown'      // Brown
    | 'orange'     // Orange
    | 'yellow'     // Yellow
    | 'green'      // Green
    | 'blue'       // Blue
    | 'purple'     // Purple
    | 'pink'       // Pink
    | 'red';       // Red

export type StatusGroup = 'todo' | 'in_progress' | 'complete';

export interface StatusOption {
    id: string;
    value: string;
    label: string;
    color: StatusColor;
    group: StatusGroup;
}

export interface SelectOption {
    id: string;
    value: string;
    label: string;
    color: StatusColor;
}

// Notion-style status config with 3 fixed groups
export interface StatusConfig {
    options: StatusOption[];
    showAsCheckbox?: boolean; // Display as checkbox instead of dropdown
}

// Select/Multi-select config
export interface SelectConfig {
    options: SelectOption[];
    maxSelections?: number; // For multi_select only
}

// Number field config
export interface NumberConfig {
    format: 'integer' | 'decimal' | 'decimal_1';
    min?: number;
    max?: number;
}

// Currency field config
export interface CurrencyConfig {
    currency: string; // USD, EUR, GBP, etc.
    decimals: number;
}

// Person field config
export interface PersonConfig {
    allowMultiple?: boolean;
    limitToTeam?: string; // Team ID filter
}

export interface ColumnConfig {
    // Legacy support - will be migrated to typed configs
    options?: string[] | StatusOption[] | SelectOption[];
    default_value?: any;
    min?: number;
    max?: number;
    currency?: string;
    related_table_id?: string;
    // New typed configs
    statusConfig?: StatusConfig;
    selectConfig?: SelectConfig;
    numberConfig?: NumberConfig;
    currencyConfig?: CurrencyConfig;
    personConfig?: PersonConfig;
}

export type TimeTrackingFrequency = 'weekly' | 'monthly' | 'quarterly';

export interface TimeTrackingMetric {
    id: string;
    name: string;
    type: 'number' | 'currency' | 'percentage';
}

export interface TimeTrackingConfig {
    enabled: boolean;
    frequency: TimeTrackingFrequency;
    metrics: TimeTrackingMetric[];
}

export interface PeriodData {
    id: string;
    table_id: string;
    row_id: string;
    period_start: string;
    period_end: string;
    period_label: string; // e.g., "November 2024", "Week 48", "Q4 2024"
    metrics: Record<string, number>; // metric_id -> value
    created_at: string;
    updated_at: string;
}

export interface DataTable {
    id: string;
    client_id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    is_template: boolean;
    template_id: string | null;
    order_index: number;
    time_tracking: TimeTrackingConfig | null;
    created_at: string;
    updated_at: string;
}

export interface DataColumn {
    id: string;
    table_id: string;
    name: string;
    type: ColumnType;
    config: ColumnConfig;
    is_required: boolean;
    is_primary: boolean;
    width: number;
    order_index: number;
    created_at: string;
    updated_at: string;
}

export interface DataRow {
    id: string;
    table_id: string;
    /**
     * Row data keyed by COLUMN ID (UUID), NOT column name.
     * Example: { "abe82b1a-deed-4580-...": "John Doe" }
     * NOT:     { "Name": "John Doe" }
     * See docs/DATA_TABLES_ARCHITECTURE.md
     */
    data: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface TemplateTimeTrackingConfig {
    enabled: boolean;
    frequency: TimeTrackingFrequency;
    metrics: Omit<TimeTrackingMetric, 'id'>[]; // IDs generated on table creation
}

export interface DataTemplate {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    category: string;
    columns: TemplateColumn[];
    time_tracking?: TemplateTimeTrackingConfig;
    created_at: string;
}

export interface TemplateColumn {
    name: string;
    type: ColumnType;
    config?: ColumnConfig;
    is_required?: boolean;
    is_primary?: boolean;
}

// Extended types with relations
export interface DataTableWithColumns extends DataTable {
    columns: DataColumn[];
}

export interface DataTableWithData extends DataTableWithColumns {
    rows: DataRow[];
}

// ============================================================================
// OVERVIEW WIDGETS SYSTEM
// ============================================================================

export type AggregationType = 'sum' | 'average' | 'min' | 'max' | 'count';

export type OverviewWidgetType = 'metric_card' | 'chart';

export type ChartType = 'pie' | 'bar' | 'donut';

export interface OverviewWidgetBase {
    id: string;
    client_id: string;
    type: OverviewWidgetType;
    label: string;
    order_index: number;
    created_at: string;
    updated_at: string;
}

export interface OverviewMetricCard extends OverviewWidgetBase {
    type: 'metric_card';
    config: {
        table_id: string;
        column_id: string;
        aggregation: AggregationType;
        format?: 'number' | 'currency' | 'percentage';
        prefix?: string;
        suffix?: string;
        icon?: string;
        color?: string;
    };
}

export interface OverviewChartWidget extends OverviewWidgetBase {
    type: 'chart';
    config: {
        table_id: string;
        column_id: string;
        chart_type: ChartType;
    };
}

export type OverviewWidget = OverviewMetricCard | OverviewChartWidget;

// Metric config type (for dashboard metric visibility settings)
export interface MetricConfig {
    id: string;
    client_id: string;
    metric_id: string;
    enabled: boolean;
    order_index: number;
    created_at: string;
    updated_at: string;
}

// API types for overview widgets
export interface OverviewWidgetWithValue extends OverviewMetricCard {
    computed_value: number | null;
}

export interface OverviewChartWidgetWithData extends OverviewChartWidget {
    computed_data: Array<{
        label: string;
        value: number;
        color?: string;
    }>;
}
