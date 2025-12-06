/**
 * Metric Library
 *
 * Defines all available metrics that clients can enable/disable and configure.
 * Metrics can appear as:
 * - Overview cards on the dashboard
 * - Columns on the members (doctors) page
 * - Aggregate calculations
 */

export type MetricType = 'overview_card' | 'member_column' | 'aggregate';
export type MetricCategory = 'overview' | 'engagement' | 'performance' | 'risk';
export type MetricDataType = 'number' | 'percentage' | 'currency' | 'date' | 'text' | 'status';

export interface MetricDefinition {
    id: string;
    name: string;
    description: string;
    type: MetricType[];
    category: MetricCategory;
    dataType: MetricDataType;
    icon?: string;
    defaultEnabled: boolean;
    // Related metrics - when this is enabled, suggest these
    relatedMetrics?: string[];
    // Calculation info
    calculationDescription?: string;
}

/**
 * Complete catalog of available metrics
 */
export const METRIC_LIBRARY: Record<string, MetricDefinition> = {
    // Overview Metrics
    total_members: {
        id: 'total_members',
        name: 'Total Members',
        description: 'Total number of members in the system',
        type: ['overview_card', 'aggregate'],
        category: 'overview',
        dataType: 'number',
        icon: 'Users',
        defaultEnabled: true,
        relatedMetrics: ['active_members', 'inactive_members'],
    },
    active_members: {
        id: 'active_members',
        name: 'Active Members',
        description: 'Members with active status',
        type: ['overview_card', 'aggregate'],
        category: 'overview',
        dataType: 'number',
        icon: 'UserCheck',
        defaultEnabled: true,
    },
    days_in_program: {
        id: 'days_in_program',
        name: 'Days in Program',
        description: 'Number of days since member started',
        type: ['member_column', 'aggregate'],
        category: 'overview',
        dataType: 'number',
        icon: 'Clock',
        defaultEnabled: true,
        relatedMetrics: ['avg_days_in_program'],
    },
    avg_days_in_program: {
        id: 'avg_days_in_program',
        name: 'Avg Days in Program',
        description: 'Average number of days members have been in the program',
        type: ['overview_card'],
        category: 'overview',
        dataType: 'number',
        icon: 'Clock',
        defaultEnabled: true,
    },

    // Engagement Metrics
    last_activity_date: {
        id: 'last_activity_date',
        name: 'Last Activity',
        description: 'Date of most recent activity',
        type: ['member_column'],
        category: 'engagement',
        dataType: 'date',
        icon: 'Calendar',
        defaultEnabled: true,
        relatedMetrics: ['days_since_activity', 'needs_attention'],
    },
    days_since_activity: {
        id: 'days_since_activity',
        name: 'Days Since Activity',
        description: 'Number of days since last activity',
        type: ['member_column'],
        category: 'engagement',
        dataType: 'number',
        icon: 'Clock',
        defaultEnabled: true,
    },
    engagement_rate: {
        id: 'engagement_rate',
        name: 'Engagement Rate',
        description: 'Percentage of members active in last 7 days',
        type: ['overview_card'],
        category: 'engagement',
        dataType: 'percentage',
        icon: 'Zap',
        defaultEnabled: true,
    },
    recent_activities_count: {
        id: 'recent_activities_count',
        name: 'Recent Activities',
        description: 'Number of activities in the last 7 days',
        type: ['overview_card'],
        category: 'engagement',
        dataType: 'number',
        icon: 'MessageSquare',
        defaultEnabled: true,
    },
    needs_attention: {
        id: 'needs_attention',
        name: 'Needs Attention',
        description: 'Members with no activity in 14+ days',
        type: ['overview_card'],
        category: 'engagement',
        dataType: 'number',
        icon: 'AlertTriangle',
        defaultEnabled: true,
    },

    // Performance Metrics - Cases
    total_cases: {
        id: 'total_cases',
        name: 'Total Cases',
        description: 'Total number of cases submitted by member',
        type: ['member_column'],
        category: 'performance',
        dataType: 'number',
        icon: 'FileText',
        defaultEnabled: true,
        relatedMetrics: ['cases_this_month', 'avg_cases_per_member'],
    },
    cases_this_month: {
        id: 'cases_this_month',
        name: 'Cases This Month',
        description: 'Total cases submitted this month across all members',
        type: ['overview_card'],
        category: 'performance',
        dataType: 'number',
        icon: 'FileText',
        defaultEnabled: true,
    },
    avg_cases_per_member: {
        id: 'avg_cases_per_member',
        name: 'Avg Cases/Member',
        description: 'Average number of cases per member',
        type: ['overview_card'],
        category: 'performance',
        dataType: 'number',
        icon: 'Activity',
        defaultEnabled: true,
    },

    // Performance Metrics - Courses
    total_courses: {
        id: 'total_courses',
        name: 'Total Courses',
        description: 'Total number of courses completed by member',
        type: ['member_column'],
        category: 'performance',
        dataType: 'number',
        icon: 'GraduationCap',
        defaultEnabled: true,
        relatedMetrics: ['courses_this_month', 'avg_courses_per_member', 'course_progress'],
    },
    course_progress: {
        id: 'course_progress',
        name: 'Course Progress',
        description: 'Percentage of course completion',
        type: ['member_column'],
        category: 'performance',
        dataType: 'percentage',
        icon: 'TrendingUp',
        defaultEnabled: true,
    },
    courses_this_month: {
        id: 'courses_this_month',
        name: 'Courses This Month',
        description: 'Total courses completed this month across all members',
        type: ['overview_card'],
        category: 'performance',
        dataType: 'number',
        icon: 'GraduationCap',
        defaultEnabled: true,
    },
    avg_courses_per_member: {
        id: 'avg_courses_per_member',
        name: 'Avg Courses/Member',
        description: 'Average number of courses per member',
        type: ['overview_card'],
        category: 'performance',
        dataType: 'number',
        icon: 'TrendingUp',
        defaultEnabled: true,
    },
    completion_rate: {
        id: 'completion_rate',
        name: 'Active Progress',
        description: 'Percentage of members making progress this period',
        type: ['overview_card'],
        category: 'performance',
        dataType: 'percentage',
        icon: 'Target',
        defaultEnabled: true,
    },

    // Risk Metrics
    risk_level: {
        id: 'risk_level',
        name: 'Risk Level',
        description: 'Current risk assessment for the member',
        type: ['member_column'],
        category: 'risk',
        dataType: 'status',
        icon: 'AlertTriangle',
        defaultEnabled: true,
        relatedMetrics: ['at_risk_count', 'on_track_count'],
    },
    at_risk_count: {
        id: 'at_risk_count',
        name: 'At Risk',
        description: 'Number of members at risk',
        type: ['overview_card'],
        category: 'risk',
        dataType: 'number',
        icon: 'AlertTriangle',
        defaultEnabled: true,
    },
    on_track_count: {
        id: 'on_track_count',
        name: 'On Track',
        description: 'Number of members performing well',
        type: ['overview_card'],
        category: 'risk',
        dataType: 'number',
        icon: 'CheckCircle2',
        defaultEnabled: true,
    },
};

/**
 * Industry-specific metric bundles
 */
export interface IndustryBundle {
    id: string;
    name: string;
    description: string;
    metrics: string[];
}

export const INDUSTRY_BUNDLES: Record<string, IndustryBundle> = {
    healthcare: {
        id: 'healthcare',
        name: 'Healthcare / Medical',
        description: 'Track doctors with cases, CME credits, and activity',
        metrics: [
            'total_members',
            'active_members',
            'days_in_program',
            'total_cases',
            'cases_this_month',
            'avg_cases_per_member',
            'total_courses',
            'course_progress',
            'courses_this_month',
            'engagement_rate',
            'recent_activities_count',
            'needs_attention',
            'risk_level',
            'at_risk_count',
            'on_track_count',
        ],
    },
    sales: {
        id: 'sales',
        name: 'Sales / Business Development',
        description: 'Track sales reps with deals, training, and performance',
        metrics: [
            'total_members',
            'active_members',
            'days_in_program',
            'total_cases', // Deals
            'cases_this_month',
            'avg_cases_per_member',
            'total_courses', // Training modules
            'course_progress',
            'engagement_rate',
            'last_activity_date',
            'days_since_activity',
            'needs_attention',
            'on_track_count',
            'at_risk_count',
        ],
    },
    franchise: {
        id: 'franchise',
        name: 'Franchise / Multi-Unit',
        description: 'Track franchisees with milestones, compliance, and support',
        metrics: [
            'total_members',
            'active_members',
            'days_in_program',
            'total_cases', // Milestones
            'cases_this_month',
            'total_courses', // Training modules
            'course_progress',
            'engagement_rate',
            'recent_activities_count',
            'needs_attention',
            'completion_rate',
            'on_track_count',
        ],
    },
    education: {
        id: 'education',
        name: 'Education / Training',
        description: 'Track students with assignments, courses, and participation',
        metrics: [
            'total_members',
            'active_members',
            'total_cases', // Assignments
            'total_courses',
            'course_progress',
            'courses_this_month',
            'avg_courses_per_member',
            'engagement_rate',
            'completion_rate',
            'on_track_count',
            'needs_attention',
        ],
    },
    saas: {
        id: 'saas',
        name: 'SaaS / Technology',
        description: 'Track customers with usage, support tickets, and adoption',
        metrics: [
            'total_members',
            'active_members',
            'days_in_program',
            'total_cases', // Support tickets
            'cases_this_month',
            'total_courses', // Tutorials completed
            'engagement_rate',
            'recent_activities_count',
            'last_activity_date',
            'days_since_activity',
            'needs_attention',
            'at_risk_count',
        ],
    },
};

/**
 * Get metrics by type
 */
export function getMetricsByType(type: MetricType): MetricDefinition[] {
    return Object.values(METRIC_LIBRARY).filter(metric =>
        metric.type.includes(type)
    );
}

/**
 * Get metrics by category
 */
export function getMetricsByCategory(category: MetricCategory): MetricDefinition[] {
    return Object.values(METRIC_LIBRARY).filter(metric =>
        metric.category === category
    );
}

/**
 * Get default enabled metrics
 */
export function getDefaultMetrics(): string[] {
    return Object.values(METRIC_LIBRARY)
        .filter(metric => metric.defaultEnabled)
        .map(metric => metric.id);
}
