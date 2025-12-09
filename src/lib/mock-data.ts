import { Doctor, Client, DSO, Activity, PeriodProgress, TaskGroup, Task, DataTable, DataColumn, DataRow, DataTemplate, ColumnType, PeriodData, TimeTrackingConfig, OverviewWidget, OverviewMetricCard, OverviewChartWidget, AggregationType } from './db/types';

export const mockClients: Client[] = [
    {
        id: '1',
        name: 'Smile Dental Group',
        industry: 'Dental Services',
        contact_name: 'Jennifer Martinez',
        contact_email: 'jennifer@smiledental.com',
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
    },
    {
        id: '2',
        name: 'Pacific Dental Services',
        industry: 'Dental Services',
        contact_name: 'Robert Chen',
        contact_email: 'robert@pacificdental.com',
        created_at: '2024-01-20T00:00:00Z',
        updated_at: '2024-01-20T00:00:00Z',
    },
    {
        id: '3',
        name: 'Aspen Dental',
        industry: 'Dental Services',
        contact_name: 'Sarah Thompson',
        contact_email: 'sarah@aspendental.com',
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-02-01T00:00:00Z',
    },
];

// Legacy alias
export const mockDSOs: DSO[] = mockClients;

export const mockDoctors: Doctor[] = [
    {
        id: '1',
        dso_id: '1',
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@smiledental.com',
        phone: '555-0101',
        start_date: '2024-02-01',
        status: 'active',
        notes: 'Enthusiastic learner, quick to adopt new techniques',
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-02-01T00:00:00Z',
    },
    {
        id: '2',
        dso_id: '1',
        name: 'Dr. Michael Chen',
        email: 'michael.chen@smiledental.com',
        phone: '555-0102',
        start_date: '2024-03-15',
        status: 'active',
        notes: 'Experienced practitioner, great mentor',
        created_at: '2024-03-15T00:00:00Z',
        updated_at: '2024-03-15T00:00:00Z',
    },
    {
        id: '3',
        dso_id: '2',
        name: 'Dr. Emily Rodriguez',
        email: 'emily.rodriguez@pacific.com',
        phone: '555-0103',
        start_date: '2024-01-10',
        status: 'active',
        notes: 'Strong communicator, excellent patient reviews',
        created_at: '2024-01-10T00:00:00Z',
        updated_at: '2024-01-10T00:00:00Z',
    },
    {
        id: '4',
        dso_id: '2',
        name: 'Dr. James Wilson',
        email: 'james.wilson@pacific.com',
        phone: '555-0104',
        start_date: '2024-04-01',
        status: 'active',
        notes: 'Needs support with digital workflows',
        created_at: '2024-04-01T00:00:00Z',
        updated_at: '2024-04-01T00:00:00Z',
    },
    {
        id: '5',
        dso_id: '3',
        name: 'Dr. Lisa Martinez',
        email: 'lisa.martinez@aspen.com',
        phone: '555-0105',
        start_date: '2024-05-01',
        status: 'active',
        notes: 'Recent graduate, very engaged',
        created_at: '2024-05-01T00:00:00Z',
        updated_at: '2024-05-01T00:00:00Z',
    },
    {
        id: '6',
        dso_id: '1',
        name: 'Dr. Robert Taylor',
        email: 'robert.taylor@smiledental.com',
        phone: '555-0106',
        start_date: '2024-02-15',
        status: 'active',
        notes: 'Prefers hands-on learning',
        created_at: '2024-02-15T00:00:00Z',
        updated_at: '2024-02-15T00:00:00Z',
    },
    {
        id: '7',
        dso_id: '2',
        name: 'Dr. Jennifer Lee',
        email: 'jennifer.lee@pacific.com',
        phone: '555-0107',
        start_date: '2024-06-01',
        status: 'inactive',
        notes: 'On medical leave',
        created_at: '2024-06-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
    },
    {
        id: '8',
        dso_id: '3',
        name: 'Dr. David Anderson',
        email: 'david.anderson@aspen.com',
        phone: '555-0108',
        start_date: '2024-03-01',
        status: 'active',
        notes: 'Excellent case documentation',
        created_at: '2024-03-01T00:00:00Z',
        updated_at: '2024-03-01T00:00:00Z',
    },
];

export const mockActivities: Activity[] = [
    {
        id: '1',
        doctor_id: '1',
        activity_type: 'call',
        description: 'Initial onboarding call, discussed program expectations and timeline. Dr. Johnson is excited to start.',
        outcome: 'positive',
        contact_name: 'Dr. Sarah Johnson',
        contact_email: 'sarah.johnson@smiledental.com',
        contact_phone: '555-0101',
        created_at: '2024-02-02T10:00:00Z',
        created_by: 'user-1',
    },
    {
        id: '2',
        doctor_id: '1',
        activity_type: 'email',
        description: 'Sent welcome materials and course access credentials. Included links to all training modules.',
        outcome: 'neutral',
        contact_name: 'Dr. Sarah Johnson',
        contact_email: 'sarah.johnson@smiledental.com',
        created_at: '2024-11-25T14:30:00Z',
        created_by: 'user-1',
    },
    {
        id: '3',
        doctor_id: '2',
        activity_type: 'meeting',
        description: 'Quarterly review meeting, discussed progress on cases and upcoming training sessions.',
        outcome: 'positive',
        contact_name: 'Dr. Michael Chen',
        contact_email: 'michael.chen@smiledental.com',
        created_at: '2024-11-20T09:00:00Z',
        created_by: 'user-1',
    },
    {
        id: '4',
        doctor_id: '3',
        activity_type: 'case_review',
        description: 'Reviewed 5 recent cases, provided detailed feedback on documentation and treatment plans.',
        outcome: 'positive',
        contact_name: 'Dr. Emily Rodriguez',
        contact_email: 'emily.rodriguez@pacific.com',
        created_at: '2024-11-26T15:00:00Z',
        created_by: 'user-2',
    },
    {
        id: '5',
        doctor_id: '4',
        activity_type: 'call',
        description: 'Follow-up call about digital workflow training. Needs additional support with software.',
        outcome: 'follow_up_needed',
        contact_name: 'Dr. James Wilson',
        contact_email: 'james.wilson@pacific.com',
        contact_phone: '555-0104',
        created_at: '2024-11-10T11:00:00Z',
        created_by: 'user-1',
    },
    {
        id: '6',
        doctor_id: '5',
        activity_type: 'training',
        description: 'Hands-on training session for new procedures. Excellent engagement and questions.',
        outcome: 'positive',
        contact_name: 'Dr. Lisa Martinez',
        contact_email: 'lisa.martinez@aspen.com',
        created_at: '2024-11-27T10:00:00Z',
        created_by: 'user-2',
    },
    {
        id: '7',
        doctor_id: '1',
        activity_type: 'sms',
        description: 'Sent reminder about upcoming deadline for case submissions.',
        outcome: 'neutral',
        contact_name: 'Dr. Sarah Johnson',
        contact_phone: '555-0101',
        created_at: '2024-11-28T09:15:00Z',
        created_by: 'user-1',
    },
    {
        id: '8',
        doctor_id: '2',
        activity_type: 'sms',
        description: 'Quick check-in about training module completion.',
        outcome: 'positive',
        contact_name: 'Dr. Michael Chen',
        contact_phone: '555-0102',
        created_at: '2024-11-22T16:00:00Z',
        created_by: 'user-1',
    },
    {
        id: '9',
        doctor_id: '3',
        activity_type: 'call',
        description: 'Monthly check-in call. Discussed expansion to additional procedures.',
        outcome: 'positive',
        contact_name: 'Dr. Emily Rodriguez',
        contact_email: 'emily.rodriguez@pacific.com',
        contact_phone: '555-0103',
        created_at: '2024-10-15T14:00:00Z',
        created_by: 'user-2',
    },
    {
        id: '10',
        doctor_id: '4',
        activity_type: 'email',
        description: 'Sent additional training resources and tutorial videos for digital workflow.',
        outcome: 'neutral',
        contact_name: 'Dr. James Wilson',
        contact_email: 'james.wilson@pacific.com',
        created_at: '2024-10-20T11:30:00Z',
        created_by: 'user-1',
    },
    {
        id: '11',
        doctor_id: '5',
        activity_type: 'meeting',
        description: 'In-person visit to clinic. Observed case workflow and provided feedback.',
        outcome: 'positive',
        contact_name: 'Dr. Lisa Martinez',
        contact_email: 'lisa.martinez@aspen.com',
        created_at: '2024-10-08T10:00:00Z',
        created_by: 'user-2',
    },
    {
        id: '12',
        doctor_id: '1',
        activity_type: 'call',
        description: 'Six-month progress review. Exceeded targets, discussed advanced certification.',
        outcome: 'positive',
        contact_name: 'Dr. Sarah Johnson',
        contact_email: 'sarah.johnson@smiledental.com',
        contact_phone: '555-0101',
        created_at: '2024-09-12T15:00:00Z',
        created_by: 'user-1',
    },
];

export const mockPeriodProgress: PeriodProgress[] = [
    // Dr. Sarah Johnson (id: '1') - 10 months in
    { id: '1', doctor_id: '1', period_number: 1, start_date: '2024-02-01', end_date: '2024-02-29', cases_submitted: 12, courses_completed: 3, notes: null, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-03-01T00:00:00Z' },
    { id: '2', doctor_id: '1', period_number: 2, start_date: '2024-03-01', end_date: '2024-03-31', cases_submitted: 15, courses_completed: 2, notes: null, created_at: '2024-03-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z' },
    { id: '3', doctor_id: '1', period_number: 3, start_date: '2024-04-01', end_date: '2024-04-30', cases_submitted: 18, courses_completed: 4, notes: null, created_at: '2024-04-01T00:00:00Z', updated_at: '2024-05-01T00:00:00Z' },
    { id: '4', doctor_id: '1', period_number: 4, start_date: '2024-05-01', end_date: '2024-05-31', cases_submitted: 16, courses_completed: 3, notes: null, created_at: '2024-05-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
    { id: '5', doctor_id: '1', period_number: 5, start_date: '2024-06-01', end_date: '2024-06-30', cases_submitted: 14, courses_completed: 2, notes: null, created_at: '2024-06-01T00:00:00Z', updated_at: '2024-07-01T00:00:00Z' },
    { id: '6', doctor_id: '1', period_number: 6, start_date: '2024-07-01', end_date: '2024-07-31', cases_submitted: 17, courses_completed: 3, notes: null, created_at: '2024-07-01T00:00:00Z', updated_at: '2024-08-01T00:00:00Z' },
    { id: '7', doctor_id: '1', period_number: 7, start_date: '2024-08-01', end_date: '2024-08-31', cases_submitted: 19, courses_completed: 4, notes: null, created_at: '2024-08-01T00:00:00Z', updated_at: '2024-09-01T00:00:00Z' },
    { id: '8', doctor_id: '1', period_number: 8, start_date: '2024-09-01', end_date: '2024-09-30', cases_submitted: 15, courses_completed: 2, notes: null, created_at: '2024-09-01T00:00:00Z', updated_at: '2024-10-01T00:00:00Z' },
    { id: '9', doctor_id: '1', period_number: 9, start_date: '2024-10-01', end_date: '2024-10-31', cases_submitted: 16, courses_completed: 3, notes: null, created_at: '2024-10-01T00:00:00Z', updated_at: '2024-11-01T00:00:00Z' },
    { id: '10', doctor_id: '1', period_number: 10, start_date: '2024-11-01', end_date: '2024-11-30', cases_submitted: 20, courses_completed: 5, notes: null, created_at: '2024-11-01T00:00:00Z', updated_at: '2024-11-27T00:00:00Z' },
    { id: '11', doctor_id: '1', period_number: 11, start_date: '2024-12-01', end_date: '2024-12-31', cases_submitted: 0, courses_completed: 0, notes: null, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z' },
    { id: '12', doctor_id: '1', period_number: 12, start_date: '2025-01-01', end_date: '2025-01-31', cases_submitted: 0, courses_completed: 0, notes: null, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z' },

    // Dr. Michael Chen (id: '2') - 8 months in
    { id: '13', doctor_id: '2', period_number: 1, start_date: '2024-03-15', end_date: '2024-04-14', cases_submitted: 10, courses_completed: 2, notes: null, created_at: '2024-03-15T00:00:00Z', updated_at: '2024-04-15T00:00:00Z' },
    { id: '14', doctor_id: '2', period_number: 2, start_date: '2024-04-15', end_date: '2024-05-14', cases_submitted: 13, courses_completed: 3, notes: null, created_at: '2024-04-15T00:00:00Z', updated_at: '2024-05-15T00:00:00Z' },
    { id: '15', doctor_id: '2', period_number: 3, start_date: '2024-05-15', end_date: '2024-06-14', cases_submitted: 11, courses_completed: 2, notes: null, created_at: '2024-05-15T00:00:00Z', updated_at: '2024-06-15T00:00:00Z' },
    { id: '16', doctor_id: '2', period_number: 4, start_date: '2024-06-15', end_date: '2024-07-14', cases_submitted: 14, courses_completed: 3, notes: null, created_at: '2024-06-15T00:00:00Z', updated_at: '2024-07-15T00:00:00Z' },
    { id: '17', doctor_id: '2', period_number: 5, start_date: '2024-07-15', end_date: '2024-08-14', cases_submitted: 12, courses_completed: 2, notes: null, created_at: '2024-07-15T00:00:00Z', updated_at: '2024-08-15T00:00:00Z' },
    { id: '18', doctor_id: '2', period_number: 6, start_date: '2024-08-15', end_date: '2024-09-14', cases_submitted: 15, courses_completed: 4, notes: null, created_at: '2024-08-15T00:00:00Z', updated_at: '2024-09-15T00:00:00Z' },
    { id: '19', doctor_id: '2', period_number: 7, start_date: '2024-09-15', end_date: '2024-10-14', cases_submitted: 13, courses_completed: 3, notes: null, created_at: '2024-09-15T00:00:00Z', updated_at: '2024-10-15T00:00:00Z' },
    { id: '20', doctor_id: '2', period_number: 8, start_date: '2024-10-15', end_date: '2024-11-14', cases_submitted: 16, courses_completed: 4, notes: null, created_at: '2024-10-15T00:00:00Z', updated_at: '2024-11-15T00:00:00Z' },

    // Dr. Emily Rodriguez (id: '3') - 11 months in
    { id: '21', doctor_id: '3', period_number: 1, start_date: '2024-01-10', end_date: '2024-02-09', cases_submitted: 14, courses_completed: 3, notes: null, created_at: '2024-01-10T00:00:00Z', updated_at: '2024-02-10T00:00:00Z' },
    { id: '22', doctor_id: '3', period_number: 2, start_date: '2024-02-10', end_date: '2024-03-09', cases_submitted: 16, courses_completed: 4, notes: null, created_at: '2024-02-10T00:00:00Z', updated_at: '2024-03-10T00:00:00Z' },
    { id: '23', doctor_id: '3', period_number: 3, start_date: '2024-03-10', end_date: '2024-04-09', cases_submitted: 18, courses_completed: 3, notes: null, created_at: '2024-03-10T00:00:00Z', updated_at: '2024-04-10T00:00:00Z' },
    { id: '24', doctor_id: '3', period_number: 4, start_date: '2024-04-10', end_date: '2024-05-09', cases_submitted: 15, courses_completed: 2, notes: null, created_at: '2024-04-10T00:00:00Z', updated_at: '2024-05-10T00:00:00Z' },
    { id: '25', doctor_id: '3', period_number: 5, start_date: '2024-05-10', end_date: '2024-06-09', cases_submitted: 17, courses_completed: 4, notes: null, created_at: '2024-05-10T00:00:00Z', updated_at: '2024-06-10T00:00:00Z' },
    { id: '26', doctor_id: '3', period_number: 6, start_date: '2024-06-10', end_date: '2024-07-09', cases_submitted: 19, courses_completed: 5, notes: null, created_at: '2024-06-10T00:00:00Z', updated_at: '2024-07-10T00:00:00Z' },
    { id: '27', doctor_id: '3', period_number: 7, start_date: '2024-07-10', end_date: '2024-08-09', cases_submitted: 16, courses_completed: 3, notes: null, created_at: '2024-07-10T00:00:00Z', updated_at: '2024-08-10T00:00:00Z' },
    { id: '28', doctor_id: '3', period_number: 8, start_date: '2024-08-10', end_date: '2024-09-09', cases_submitted: 18, courses_completed: 4, notes: null, created_at: '2024-08-10T00:00:00Z', updated_at: '2024-09-10T00:00:00Z' },
    { id: '29', doctor_id: '3', period_number: 9, start_date: '2024-09-10', end_date: '2024-10-09', cases_submitted: 20, courses_completed: 5, notes: null, created_at: '2024-09-10T00:00:00Z', updated_at: '2024-10-10T00:00:00Z' },
    { id: '30', doctor_id: '3', period_number: 10, start_date: '2024-10-10', end_date: '2024-11-09', cases_submitted: 17, courses_completed: 3, notes: null, created_at: '2024-10-10T00:00:00Z', updated_at: '2024-11-10T00:00:00Z' },
    { id: '31', doctor_id: '3', period_number: 11, start_date: '2024-11-10', end_date: '2024-12-09', cases_submitted: 22, courses_completed: 6, notes: null, created_at: '2024-11-10T00:00:00Z', updated_at: '2024-11-27T00:00:00Z' },

    // Dr. James Wilson (id: '4') - 8 months in, at risk
    { id: '32', doctor_id: '4', period_number: 1, start_date: '2024-04-01', end_date: '2024-04-30', cases_submitted: 8, courses_completed: 1, notes: null, created_at: '2024-04-01T00:00:00Z', updated_at: '2024-05-01T00:00:00Z' },
    { id: '33', doctor_id: '4', period_number: 2, start_date: '2024-05-01', end_date: '2024-05-31', cases_submitted: 6, courses_completed: 1, notes: null, created_at: '2024-05-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
    { id: '34', doctor_id: '4', period_number: 3, start_date: '2024-06-01', end_date: '2024-06-30', cases_submitted: 7, courses_completed: 0, notes: null, created_at: '2024-06-01T00:00:00Z', updated_at: '2024-07-01T00:00:00Z' },
    { id: '35', doctor_id: '4', period_number: 4, start_date: '2024-07-01', end_date: '2024-07-31', cases_submitted: 5, courses_completed: 1, notes: null, created_at: '2024-07-01T00:00:00Z', updated_at: '2024-08-01T00:00:00Z' },
    { id: '36', doctor_id: '4', period_number: 5, start_date: '2024-08-01', end_date: '2024-08-31', cases_submitted: 9, courses_completed: 2, notes: null, created_at: '2024-08-01T00:00:00Z', updated_at: '2024-09-01T00:00:00Z' },
    { id: '37', doctor_id: '4', period_number: 6, start_date: '2024-09-01', end_date: '2024-09-30', cases_submitted: 4, courses_completed: 0, notes: null, created_at: '2024-09-01T00:00:00Z', updated_at: '2024-10-01T00:00:00Z' },
    { id: '38', doctor_id: '4', period_number: 7, start_date: '2024-10-01', end_date: '2024-10-31', cases_submitted: 6, courses_completed: 1, notes: null, created_at: '2024-10-01T00:00:00Z', updated_at: '2024-11-01T00:00:00Z' },
    { id: '39', doctor_id: '4', period_number: 8, start_date: '2024-11-01', end_date: '2024-11-30', cases_submitted: 3, courses_completed: 0, notes: null, created_at: '2024-11-01T00:00:00Z', updated_at: '2024-11-10T00:00:00Z' },

    // Dr. Lisa Martinez (id: '5') - 7 months in, performing well
    { id: '40', doctor_id: '5', period_number: 1, start_date: '2024-05-01', end_date: '2024-05-31', cases_submitted: 11, courses_completed: 2, notes: null, created_at: '2024-05-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
    { id: '41', doctor_id: '5', period_number: 2, start_date: '2024-06-01', end_date: '2024-06-30', cases_submitted: 13, courses_completed: 3, notes: null, created_at: '2024-06-01T00:00:00Z', updated_at: '2024-07-01T00:00:00Z' },
    { id: '42', doctor_id: '5', period_number: 3, start_date: '2024-07-01', end_date: '2024-07-31', cases_submitted: 15, courses_completed: 4, notes: null, created_at: '2024-07-01T00:00:00Z', updated_at: '2024-08-01T00:00:00Z' },
    { id: '43', doctor_id: '5', period_number: 4, start_date: '2024-08-01', end_date: '2024-08-31', cases_submitted: 14, courses_completed: 3, notes: null, created_at: '2024-08-01T00:00:00Z', updated_at: '2024-09-01T00:00:00Z' },
    { id: '44', doctor_id: '5', period_number: 5, start_date: '2024-09-01', end_date: '2024-09-30', cases_submitted: 16, courses_completed: 4, notes: null, created_at: '2024-09-01T00:00:00Z', updated_at: '2024-10-01T00:00:00Z' },
    { id: '45', doctor_id: '5', period_number: 6, start_date: '2024-10-01', end_date: '2024-10-31', cases_submitted: 17, courses_completed: 5, notes: null, created_at: '2024-10-01T00:00:00Z', updated_at: '2024-11-01T00:00:00Z' },
    { id: '46', doctor_id: '5', period_number: 7, start_date: '2024-11-01', end_date: '2024-11-30', cases_submitted: 18, courses_completed: 4, notes: null, created_at: '2024-11-01T00:00:00Z', updated_at: '2024-11-27T00:00:00Z' },
];

export const mockTaskGroups: TaskGroup[] = [
    {
        id: '1',
        name: 'To Do',
        description: 'Tasks that need to be started',
        order_index: 0,
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: '2',
        name: 'In Progress',
        description: 'Tasks currently being worked on',
        order_index: 1,
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: '3',
        name: 'Completed',
        description: 'Tasks that have been finished',
        order_index: 2,
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: '4',
        name: 'Blocked',
        description: 'Tasks that are blocked or need attention',
        order_index: 3,
        created_at: '2024-01-01T00:00:00Z',
    },
];

export const mockTasks: Task[] = [
    // Dr. Sarah Johnson's tasks
    {
        id: '1',
        task_group_id: '3',
        doctor_id: '1',
        title: 'Complete onboarding paperwork',
        description: 'Fill out all required forms and submit to HR',
        status: 'completed',
        due_date: '2024-02-05',
        completed_at: '2024-02-04T10:30:00Z',
        order_index: 0,
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-02-04T10:30:00Z',
    },
    {
        id: '2',
        task_group_id: '3',
        doctor_id: '1',
        title: 'Initial system training',
        description: 'Complete training on practice management system',
        status: 'completed',
        due_date: '2024-02-10',
        completed_at: '2024-02-09T14:00:00Z',
        order_index: 1,
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-02-09T14:00:00Z',
    },
    {
        id: '3',
        task_group_id: '2',
        doctor_id: '1',
        title: 'Submit first 5 cases',
        description: 'Complete and submit first 5 patient cases for review',
        status: 'in_progress',
        due_date: '2024-12-15',
        completed_at: null,
        order_index: 0,
        created_at: '2024-02-10T00:00:00Z',
        updated_at: '2024-11-20T00:00:00Z',
    },
    {
        id: '4',
        task_group_id: '1',
        doctor_id: '1',
        title: 'Advanced technique workshop',
        description: 'Attend quarterly advanced techniques workshop',
        status: 'pending',
        due_date: '2024-12-30',
        completed_at: null,
        order_index: 0,
        created_at: '2024-11-01T00:00:00Z',
        updated_at: '2024-11-01T00:00:00Z',
    },
    // Dr. Michael Chen's tasks
    {
        id: '5',
        task_group_id: '3',
        doctor_id: '2',
        title: 'Complete onboarding paperwork',
        description: 'Fill out all required forms and submit to HR',
        status: 'completed',
        due_date: '2024-03-20',
        completed_at: '2024-03-18T09:00:00Z',
        order_index: 2,
        created_at: '2024-03-15T00:00:00Z',
        updated_at: '2024-03-18T09:00:00Z',
    },
    {
        id: '6',
        task_group_id: '2',
        doctor_id: '2',
        title: 'Shadow senior doctor',
        description: 'Shadow Dr. Taylor for 2 weeks to learn practice workflow',
        status: 'in_progress',
        due_date: '2024-12-05',
        completed_at: null,
        order_index: 1,
        created_at: '2024-03-20T00:00:00Z',
        updated_at: '2024-11-25T00:00:00Z',
    },
    {
        id: '7',
        task_group_id: '1',
        doctor_id: '2',
        title: 'Complete course: Digital Workflow Basics',
        description: 'Complete online course on digital workflows',
        status: 'pending',
        due_date: '2024-12-20',
        completed_at: null,
        order_index: 1,
        created_at: '2024-11-01T00:00:00Z',
        updated_at: '2024-11-01T00:00:00Z',
    },
    // Dr. Emily Rodriguez's tasks
    {
        id: '8',
        task_group_id: '3',
        doctor_id: '3',
        title: 'Equipment orientation',
        description: 'Learn to use all equipment in practice',
        status: 'completed',
        due_date: '2024-01-20',
        completed_at: '2024-01-19T11:00:00Z',
        order_index: 3,
        created_at: '2024-01-10T00:00:00Z',
        updated_at: '2024-01-19T11:00:00Z',
    },
    {
        id: '9',
        task_group_id: '3',
        doctor_id: '3',
        title: 'Meet with mentor',
        description: 'Initial meeting with assigned mentor',
        status: 'completed',
        due_date: '2024-01-15',
        completed_at: '2024-01-14T15:00:00Z',
        order_index: 4,
        created_at: '2024-01-10T00:00:00Z',
        updated_at: '2024-01-14T15:00:00Z',
    },
    {
        id: '10',
        task_group_id: '1',
        doctor_id: '3',
        title: 'Quarter 4 progress review',
        description: 'Schedule and complete Q4 progress review meeting',
        status: 'pending',
        due_date: '2024-12-28',
        completed_at: null,
        order_index: 2,
        created_at: '2024-11-15T00:00:00Z',
        updated_at: '2024-11-15T00:00:00Z',
    },
    // Dr. James Wilson's tasks
    {
        id: '11',
        task_group_id: '2',
        doctor_id: '4',
        title: 'Complete onboarding paperwork',
        description: 'Fill out all required forms and submit to HR',
        status: 'in_progress',
        due_date: '2024-12-10',
        completed_at: null,
        order_index: 2,
        created_at: '2024-04-01T00:00:00Z',
        updated_at: '2024-11-22T00:00:00Z',
    },
    {
        id: '12',
        task_group_id: '4',
        doctor_id: '4',
        title: 'System access setup',
        description: 'Get access credentials for all required systems',
        status: 'blocked',
        due_date: '2024-12-05',
        completed_at: null,
        order_index: 0,
        created_at: '2024-04-01T00:00:00Z',
        updated_at: '2024-11-20T00:00:00Z',
    },
    {
        id: '13',
        task_group_id: '1',
        doctor_id: '4',
        title: 'Complete digital workflow training',
        description: 'Attend training session on digital workflows',
        status: 'pending',
        due_date: '2024-12-18',
        completed_at: null,
        order_index: 3,
        created_at: '2024-11-01T00:00:00Z',
        updated_at: '2024-11-01T00:00:00Z',
    },
    // Dr. Lisa Martinez's tasks
    {
        id: '14',
        task_group_id: '2',
        doctor_id: '5',
        title: 'Complete onboarding paperwork',
        description: 'Fill out all required forms and submit to HR',
        status: 'in_progress',
        due_date: '2024-12-10',
        completed_at: null,
        order_index: 3,
        created_at: '2024-05-01T00:00:00Z',
        updated_at: '2024-11-25T00:00:00Z',
    },
    {
        id: '15',
        task_group_id: '1',
        doctor_id: '5',
        title: 'Schedule mentor sessions',
        description: 'Set up regular meetings with assigned mentor',
        status: 'pending',
        due_date: '2024-12-12',
        completed_at: null,
        order_index: 4,
        created_at: '2024-05-05T00:00:00Z',
        updated_at: '2024-05-05T00:00:00Z',
    },
    {
        id: '16',
        task_group_id: '1',
        doctor_id: '5',
        title: 'Complete course: Patient Communication',
        description: 'Online course on effective patient communication',
        status: 'pending',
        due_date: '2024-12-22',
        completed_at: null,
        order_index: 5,
        created_at: '2024-11-10T00:00:00Z',
        updated_at: '2024-11-10T00:00:00Z',
    },
];

// Helper functions to query mock data
export function getDoctorById(id: string) {
    return mockDoctors.find(d => d.id === id);
}

export function getDoctorsByDSO(dsoId: string) {
    return mockDoctors.filter(d => d.dso_id === dsoId);
}

export function getDoctorsByStatus(status: string) {
    return mockDoctors.filter(d => d.status === status);
}

export function searchDoctors(searchTerm: string) {
    const term = searchTerm.toLowerCase();
    return mockDoctors.filter(d =>
        d.name.toLowerCase().includes(term) ||
        d.email?.toLowerCase().includes(term)
    );
}

export function getPeriodProgressByDoctor(doctorId: string) {
    return mockPeriodProgress.filter(p => p.doctor_id === doctorId);
}

export function getActivitiesByDoctor(doctorId: string) {
    return mockActivities.filter(a => a.doctor_id === doctorId);
}

export function getLastActivityByDoctor(doctorId: string) {
    const activities = getActivitiesByDoctor(doctorId);
    if (activities.length === 0) return null;
    return activities.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
}

export function getDSOById(id: string) {
    return mockDSOs.find(d => d.id === id);
}

export function getTasksByDoctor(doctorId: string) {
    return mockTasks.filter(t => t.doctor_id === doctorId);
}

export function getTasksByGroup(groupId: string) {
    return mockTasks.filter(t => t.task_group_id === groupId);
}

export function getTasksByStatus(status: string) {
    return mockTasks.filter(t => t.status === status);
}

export function getAllTasks() {
    return mockTasks;
}

export function getAllTaskGroups() {
    return mockTaskGroups.sort((a, b) => a.order_index - b.order_index);
}

// ============================================================================
// FLEXIBLE DATA TABLES MOCK DATA
// ============================================================================

export const mockDataTemplates: DataTemplate[] = [
    {
        id: 'attendee-tracker',
        name: 'Attendee Tracker',
        description: 'Track attendees with monthly progress metrics (Scans, Accepted, Diagnosed)',
        icon: 'users',
        color: 'blue',
        category: 'customer_success',
        columns: [
            { name: 'Name', type: 'text', is_primary: true, is_required: true },
            { name: 'Blueprint', type: 'percentage', config: { default_value: 0 } },
            { name: 'Phone', type: 'phone' },
            { name: 'Email', type: 'email' },
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
    {
        id: 'weekly-collections',
        name: 'Weekly Collections',
        description: 'Track weekly collection metrics and performance',
        icon: 'calendar',
        color: 'green',
        category: 'operations',
        columns: [
            { name: 'Name', type: 'text', is_primary: true, is_required: true },
            { name: 'Region', type: 'select', config: { options: ['North', 'South', 'East', 'West'] } },
            { name: 'Status', type: 'status', config: { options: [
                { id: 's1', value: 'not_started', label: 'Not Started', color: 'gray', group: 'todo' },
                { id: 's2', value: 'on_track', label: 'On Track', color: 'blue', group: 'in_progress' },
                { id: 's3', value: 'behind', label: 'Behind', color: 'orange', group: 'in_progress' },
                { id: 's4', value: 'on_target', label: 'On Target', color: 'green', group: 'complete' },
                { id: 's5', value: 'critical', label: 'Critical', color: 'red', group: 'complete' },
            ] } },
        ],
        time_tracking: {
            enabled: true,
            frequency: 'weekly',
            metrics: [
                { name: 'Collected', type: 'currency' },
                { name: 'Target', type: 'currency' },
                { name: 'Completion', type: 'percentage' },
            ],
        },
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 'doctors',
        name: 'Doctors / Providers',
        description: 'Track healthcare providers through onboarding and engagement',
        icon: 'user-round',
        color: 'purple',
        category: 'customer_success',
        columns: [
            { name: 'Name', type: 'text', is_primary: true, is_required: true },
            { name: 'Email', type: 'email' },
            { name: 'Phone', type: 'phone' },
            { name: 'Start Date', type: 'date', is_required: true },
            { name: 'Status', type: 'status', config: { options: [{ id: 'd1', value: 'active', label: 'Active', color: 'green' }, { id: 'd2', value: 'at_risk', label: 'At Risk', color: 'orange' }, { id: 'd3', value: 'inactive', label: 'Inactive', color: 'gray' }, { id: 'd4', value: 'completed', label: 'Completed', color: 'blue' }] } },
            { name: 'Cases Submitted', type: 'number', config: { default_value: 0 } },
            { name: 'Courses Completed', type: 'number', config: { default_value: 0 } },
            { name: 'Last Contact', type: 'date' },
            { name: 'Notes', type: 'text' },
        ],
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 'accounts',
        name: 'Accounts',
        description: 'Manage customer accounts and organizations',
        icon: 'building-2',
        color: 'purple',
        category: 'customer_success',
        columns: [
            { name: 'Account Name', type: 'text', is_primary: true, is_required: true },
            { name: 'Industry', type: 'select', config: { options: ['Healthcare', 'Technology', 'Finance', 'Retail', 'Other'] } },
            { name: 'Health Score', type: 'status', config: { options: [{ id: 'h1', value: 'healthy', label: 'Healthy', color: 'green' }, { id: 'h2', value: 'neutral', label: 'Neutral', color: 'yellow' }, { id: 'h3', value: 'at_risk', label: 'At Risk', color: 'red' }] } },
            { name: 'ARR', type: 'currency' },
            { name: 'Contract Start', type: 'date' },
            { name: 'Renewal Date', type: 'date' },
            { name: 'CSM', type: 'person' },
            { name: 'Notes', type: 'text' },
        ],
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 'contacts',
        name: 'Contacts',
        description: 'Key contacts and stakeholders',
        icon: 'users',
        color: 'green',
        category: 'customer_success',
        columns: [
            { name: 'Name', type: 'text', is_primary: true, is_required: true },
            { name: 'Email', type: 'email', is_required: true },
            { name: 'Phone', type: 'phone' },
            { name: 'Role', type: 'text' },
            { name: 'Company', type: 'text' },
            { name: 'Last Contact', type: 'date' },
            { name: 'Preferred Contact', type: 'select', config: { options: ['Email', 'Phone', 'Slack', 'Other'] } },
            { name: 'Notes', type: 'text' },
        ],
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 'touchpoints',
        name: 'Touchpoints',
        description: 'Log customer interactions and activities',
        icon: 'message-circle',
        color: 'orange',
        category: 'customer_success',
        columns: [
            { name: 'Subject', type: 'text', is_primary: true, is_required: true },
            { name: 'Type', type: 'select', config: { options: ['Call', 'Email', 'Meeting', 'Training', 'Support', 'Other'] }, is_required: true },
            { name: 'Date', type: 'datetime', is_required: true },
            { name: 'Contact', type: 'text' },
            { name: 'Outcome', type: 'status', config: { options: [{ id: 'o1', value: 'positive', label: 'Positive', color: 'green' }, { id: 'o2', value: 'neutral', label: 'Neutral', color: 'gray' }, { id: 'o3', value: 'negative', label: 'Negative', color: 'red' }] } },
            { name: 'Follow-up Needed', type: 'checkbox' },
            { name: 'Notes', type: 'text' },
        ],
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 'tasks',
        name: 'Tasks',
        description: 'Track action items and to-dos',
        icon: 'check-square',
        color: 'indigo',
        category: 'general',
        columns: [
            { name: 'Task', type: 'text', is_primary: true, is_required: true },
            { name: 'Status', type: 'status', config: { options: [
                { id: 't1', value: 'todo', label: 'To Do', color: 'gray', group: 'todo' },
                { id: 't2', value: 'in_progress', label: 'In Progress', color: 'blue', group: 'in_progress' },
                { id: 't3', value: 'in_review', label: 'In Review', color: 'purple', group: 'in_progress' },
                { id: 't4', value: 'done', label: 'Done', color: 'green', group: 'complete' },
                { id: 't5', value: 'cancelled', label: 'Cancelled', color: 'red', group: 'complete' },
            ] } },
            { name: 'Priority', type: 'select', config: { options: ['Low', 'Medium', 'High', 'Urgent'] } },
            { name: 'Due Date', type: 'date' },
            { name: 'Assignee', type: 'person' },
            { name: 'Completed', type: 'checkbox' },
            { name: 'Notes', type: 'text' },
        ],
        created_at: '2024-01-01T00:00:00Z',
    },
];

// Use global store to ensure data persists across Next.js API route module instances
declare global {
    // eslint-disable-next-line no-var
    var __mockDataStore: {
        tables: DataTable[];
        columns: DataColumn[];
        rows: DataRow[];
        periods: PeriodData[];
    } | undefined;
}

// Initialize global store if it doesn't exist
if (!global.__mockDataStore) {
    global.__mockDataStore = {
        tables: [],
        columns: [],
        rows: [],
        periods: [],
    };
}

// Export references to the global store
export const mockDataTables = global.__mockDataStore.tables;
export const mockDataColumns = global.__mockDataStore.columns;
export const mockDataRows = global.__mockDataStore.rows;
export const mockPeriodData = global.__mockDataStore.periods;

// Helper functions for data tables
let nextTableId = 1;
let nextColumnId = 1;
let nextRowId = 1;
let nextPeriodId = 1;

export function createDataTable(clientId: string, name: string, templateId?: string): DataTable {
    const template = templateId ? mockDataTemplates.find(t => t.id === templateId) : undefined;

    // Build time_tracking config from template
    let timeTracking: TimeTrackingConfig | null = null;
    if (template?.time_tracking?.enabled) {
        timeTracking = {
            enabled: true,
            frequency: template.time_tracking.frequency,
            metrics: template.time_tracking.metrics.map(m => ({
                id: `metric-${nextPeriodId++}`,
                name: m.name,
                type: m.type,
            })),
        };
    }

    const table: DataTable = {
        id: String(nextTableId++),
        client_id: clientId,
        name: template?.name || name,
        description: template?.description || null,
        icon: template?.icon || 'table',
        color: template?.color || 'blue',
        is_template: !!templateId,
        template_id: templateId || null,
        order_index: mockDataTables.filter(t => t.client_id === clientId).length,
        time_tracking: timeTracking,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    mockDataTables.push(table);

    // Create columns from template
    const columnIds: Record<string, string> = {};
    if (template) {
        template.columns.forEach((col, index) => {
            const column: DataColumn = {
                id: String(nextColumnId++),
                table_id: table.id,
                name: col.name,
                type: col.type as ColumnType,
                config: col.config || {},
                is_required: col.is_required || false,
                is_primary: col.is_primary || false,
                width: 150,
                order_index: index,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockDataColumns.push(column);
            columnIds[col.name] = column.id;
        });

    }

    return table;
}

export function createDataColumn(tableId: string, name: string, type: ColumnType, config?: any): DataColumn {
    const existingColumns = mockDataColumns.filter(c => c.table_id === tableId);

    const column: DataColumn = {
        id: String(nextColumnId++),
        table_id: tableId,
        name,
        type,
        config: config || {},
        is_required: false,
        is_primary: existingColumns.length === 0,
        width: 150,
        order_index: existingColumns.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    mockDataColumns.push(column);
    return column;
}

export function createDataRow(tableId: string, data: Record<string, any> = {}): DataRow {
    const row: DataRow = {
        id: String(nextRowId++),
        table_id: tableId,
        data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    mockDataRows.push(row);
    return row;
}

export function updateDataRow(rowId: string, data: Record<string, any>): DataRow | null {
    const rowIndex = mockDataRows.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return null;

    mockDataRows[rowIndex] = {
        ...mockDataRows[rowIndex],
        data: { ...mockDataRows[rowIndex].data, ...data },
        updated_at: new Date().toISOString(),
    };

    return mockDataRows[rowIndex];
}

export function updateDataColumn(columnId: string, updates: Partial<DataColumn>): DataColumn | null {
    const columnIndex = mockDataColumns.findIndex(c => c.id === columnId);
    if (columnIndex === -1) return null;

    mockDataColumns[columnIndex] = {
        ...mockDataColumns[columnIndex],
        ...updates,
        updated_at: new Date().toISOString(),
    };

    return mockDataColumns[columnIndex];
}

export function deleteDataColumn(columnId: string): boolean {
    const columnIndex = mockDataColumns.findIndex(c => c.id === columnId);
    if (columnIndex === -1) return false;

    const column = mockDataColumns[columnIndex];
    mockDataColumns.splice(columnIndex, 1);

    // Remove column data from all rows
    mockDataRows
        .filter(r => r.table_id === column.table_id)
        .forEach(row => {
            delete row.data[columnId];
        });

    return true;
}

export function deleteDataRow(rowId: string): boolean {
    const rowIndex = mockDataRows.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return false;

    mockDataRows.splice(rowIndex, 1);
    return true;
}

export function deleteDataTable(tableId: string): boolean {
    const tableIndex = mockDataTables.findIndex(t => t.id === tableId);
    if (tableIndex === -1) return false;

    mockDataTables.splice(tableIndex, 1);

    // Remove columns in place
    for (let i = mockDataColumns.length - 1; i >= 0; i--) {
        if (mockDataColumns[i].table_id === tableId) {
            mockDataColumns.splice(i, 1);
        }
    }

    // Remove rows in place
    for (let i = mockDataRows.length - 1; i >= 0; i--) {
        if (mockDataRows[i].table_id === tableId) {
            mockDataRows.splice(i, 1);
        }
    }

    return true;
}

export function getDataTablesByClient(clientId: string): DataTable[] {
    return mockDataTables.filter(t => t.client_id === clientId);
}

export function getDataTableById(tableId: string): DataTable | undefined {
    return mockDataTables.find(t => t.id === tableId);
}

export function getColumnsByTable(tableId: string): DataColumn[] {
    return mockDataColumns
        .filter(c => c.table_id === tableId)
        .sort((a, b) => a.order_index - b.order_index);
}

export function getRowsByTable(tableId: string): DataRow[] {
    return mockDataRows.filter(r => r.table_id === tableId);
}

export function getTemplates(): DataTemplate[] {
    return mockDataTemplates;
}

export function getTemplateById(templateId: string): DataTemplate | undefined {
    return mockDataTemplates.find(t => t.id === templateId);
}

// ============================================================================
// PERIOD DATA CRUD FUNCTIONS
// ============================================================================

export function getPeriodDataByRow(tableId: string, rowId: string): PeriodData[] {
    return mockPeriodData
        .filter(p => p.table_id === tableId && p.row_id === rowId)
        .sort((a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime());
}

export function getPeriodDataById(periodId: string): PeriodData | undefined {
    return mockPeriodData.find(p => p.id === periodId);
}

export function createPeriodData(
    tableId: string,
    rowId: string,
    periodStart: string,
    periodEnd: string,
    periodLabel: string,
    metrics: Record<string, number> = {}
): PeriodData {
    const period: PeriodData = {
        id: String(nextPeriodId++),
        table_id: tableId,
        row_id: rowId,
        period_start: periodStart,
        period_end: periodEnd,
        period_label: periodLabel,
        metrics,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    mockPeriodData.push(period);
    return period;
}

export function updatePeriodData(periodId: string, metrics: Record<string, number>): PeriodData | null {
    const index = mockPeriodData.findIndex(p => p.id === periodId);
    if (index === -1) return null;

    mockPeriodData[index] = {
        ...mockPeriodData[index],
        metrics: { ...mockPeriodData[index].metrics, ...metrics },
        updated_at: new Date().toISOString(),
    };
    return mockPeriodData[index];
}

export function deletePeriodData(periodId: string): boolean {
    const index = mockPeriodData.findIndex(p => p.id === periodId);
    if (index === -1) return false;
    mockPeriodData.splice(index, 1);
    return true;
}

export function clearPeriodsForTable(tableId: string): void {
    // Remove all periods for all rows in a table (mutate in place)
    const beforeCount = mockPeriodData.length;
    console.log(`[CLEAR PERIODS] Before: ${beforeCount} periods, clearing for tableId=${tableId}`);
    console.log(`[CLEAR PERIODS] Sample period table_ids: ${mockPeriodData.slice(0, 3).map(p => p.table_id).join(', ')}`);

    for (let i = mockPeriodData.length - 1; i >= 0; i--) {
        if (mockPeriodData[i].table_id === tableId) {
            mockPeriodData.splice(i, 1);
        }
    }

    const afterCount = mockPeriodData.length;
    console.log(`[CLEAR PERIODS] After: ${afterCount} periods (removed ${beforeCount - afterCount})`);
}

export function initializePeriodsForRow(tableId: string, rowId: string, frequency: 'weekly' | 'monthly' | 'quarterly'): PeriodData[] {
    const table = getDataTableById(tableId);
    if (!table?.time_tracking?.enabled) return [];

    const periods: PeriodData[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();

    if (frequency === 'monthly') {
        // Create 12 months of periods starting from current year
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];

        for (let month = 0; month < 12; month++) {
            const startDate = new Date(currentYear, month, 1);
            const endDate = new Date(currentYear, month + 1, 0); // Last day of month

            const period = createPeriodData(
                tableId,
                rowId,
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0],
                monthNames[month],
                {} // Initialize with empty metrics (all zeros)
            );

            // Initialize all metrics to 0
            if (table.time_tracking.metrics) {
                table.time_tracking.metrics.forEach(metric => {
                    period.metrics[metric.id] = 0;
                });
            }

            periods.push(period);
        }
    } else if (frequency === 'weekly') {
        // Create 52 weeks of periods with date range labels
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        for (let week = 1; week <= 52; week++) {
            const startDate = getWeekStartDate(currentYear, week);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);

            // Format label as "Dec 2-8" or "Nov 25 - Dec 1" if spanning months
            const startMonth = shortMonths[startDate.getMonth()];
            const endMonth = shortMonths[endDate.getMonth()];
            const startDay = startDate.getDate();
            const endDay = endDate.getDate();

            let label: string;
            if (startMonth === endMonth) {
                label = `${startMonth} ${startDay}-${endDay}`;
            } else {
                label = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
            }

            const period = createPeriodData(
                tableId,
                rowId,
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0],
                label,
                {}
            );

            if (table.time_tracking.metrics) {
                table.time_tracking.metrics.forEach(metric => {
                    period.metrics[metric.id] = 0;
                });
            }

            periods.push(period);
        }
    } else if (frequency === 'quarterly') {
        const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];
        for (let q = 0; q < 4; q++) {
            const startMonth = q * 3;
            const startDate = new Date(currentYear, startMonth, 1);
            const endDate = new Date(currentYear, startMonth + 3, 0);

            const period = createPeriodData(
                tableId,
                rowId,
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0],
                `${quarterNames[q]} ${currentYear}`,
                {}
            );

            if (table.time_tracking.metrics) {
                table.time_tracking.metrics.forEach(metric => {
                    period.metrics[metric.id] = 0;
                });
            }

            periods.push(period);
        }
    }

    return periods;
}

function getWeekStartDate(year: number, week: number): Date {
    const jan1 = new Date(year, 0, 1);
    const daysOffset = (week - 1) * 7;
    const dayOfWeek = jan1.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);

    const result = new Date(year, 0, 1 + daysToMonday + daysOffset);
    return result;
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

// ============================================================================
// SAMPLE DATA POPULATION REMOVED FOR PRODUCTION
// ============================================================================
// All sample data population functions have been removed.
// Tables now start empty - users must add their own data.

// ============================================================================
// OVERVIEW WIDGETS SYSTEM
// ============================================================================

export let mockOverviewWidgets: OverviewWidget[] = [];
let nextWidgetId = 1;

export function getOverviewWidgetsByClient(clientId: string): OverviewWidget[] {
    return mockOverviewWidgets
        .filter(w => w.client_id === clientId)
        .sort((a, b) => a.order_index - b.order_index);
}

export function getOverviewWidgetById(widgetId: string): OverviewWidget | undefined {
    return mockOverviewWidgets.find(w => w.id === widgetId);
}

export function createOverviewWidget(
    clientId: string,
    type: 'metric_card' | 'chart',
    label: string,
    config: OverviewMetricCard['config'] | OverviewChartWidget['config']
): OverviewWidget {
    const existingWidgets = mockOverviewWidgets.filter(w => w.client_id === clientId);

    const widget: OverviewWidget = {
        id: String(nextWidgetId++),
        client_id: clientId,
        type,
        label,
        order_index: existingWidgets.length,
        config,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    } as OverviewWidget;

    mockOverviewWidgets.push(widget);
    return widget;
}

export function updateOverviewWidget(
    widgetId: string,
    updates: Partial<Pick<OverviewWidget, 'label' | 'order_index' | 'config'>>
): OverviewWidget | null {
    const index = mockOverviewWidgets.findIndex(w => w.id === widgetId);
    if (index === -1) return null;

    mockOverviewWidgets[index] = {
        ...mockOverviewWidgets[index],
        ...updates,
        updated_at: new Date().toISOString(),
    } as OverviewWidget;

    return mockOverviewWidgets[index];
}

export function deleteOverviewWidget(widgetId: string): boolean {
    const index = mockOverviewWidgets.findIndex(w => w.id === widgetId);
    if (index === -1) return false;

    const widget = mockOverviewWidgets[index];
    mockOverviewWidgets.splice(index, 1);

    // Reorder remaining widgets
    mockOverviewWidgets
        .filter(w => w.client_id === widget.client_id && w.order_index > widget.order_index)
        .forEach(w => {
            w.order_index--;
        });

    return true;
}

export function reorderOverviewWidgets(clientId: string, widgetIds: string[]): void {
    widgetIds.forEach((id, index) => {
        const widget = mockOverviewWidgets.find(w => w.id === id && w.client_id === clientId);
        if (widget) {
            widget.order_index = index;
            widget.updated_at = new Date().toISOString();
        }
    });
}

// Get aggregatable columns (number, currency, percentage) from a table
export function getAggregatableColumns(tableId: string): DataColumn[] {
    const numericTypes = ['number', 'currency', 'percentage'];
    return mockDataColumns
        .filter(c => c.table_id === tableId && numericTypes.includes(c.type))
        .sort((a, b) => a.order_index - b.order_index);
}

// Get status/select columns for chart widgets
export function getChartableColumns(tableId: string): DataColumn[] {
    const chartableTypes = ['status', 'select'];
    return mockDataColumns
        .filter(c => c.table_id === tableId && chartableTypes.includes(c.type))
        .sort((a, b) => a.order_index - b.order_index);
}

// Calculate aggregation for a column
export function calculateAggregation(
    tableId: string,
    columnId: string,
    aggregation: AggregationType
): number | null {
    const rows = mockDataRows.filter(r => r.table_id === tableId);
    if (rows.length === 0) return null;

    // Coerce values to numbers - handle both number and string types
    const values = rows
        .map(r => {
            const val = r.data[columnId];
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const parsed = parseFloat(val);
                return isNaN(parsed) ? null : parsed;
            }
            return null;
        })
        .filter((v): v is number => v !== null);

    if (values.length === 0) return null;

    switch (aggregation) {
        case 'sum':
            return values.reduce((a, b) => a + b, 0);
        case 'average':
            return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
        case 'min':
            return Math.min(...values);
        case 'max':
            return Math.max(...values);
        case 'count':
            return values.length;
        default:
            return null;
    }
}

// Calculate chart data for status/select columns
export function calculateChartData(
    tableId: string,
    columnId: string
): Array<{ label: string; value: number; color?: string }> {
    const column = mockDataColumns.find(c => c.id === columnId);
    if (!column) return [];

    const rows = mockDataRows.filter(r => r.table_id === tableId);
    const counts: Record<string, number> = {};

    rows.forEach(row => {
        const value = row.data[columnId];
        if (value) {
            counts[value] = (counts[value] || 0) + 1;
        }
    });

    // Get color mapping from column config if it's a status column
    const options = column.config?.options as Array<{ value: string; label: string; color: string }> | string[] | undefined;

    return Object.entries(counts).map(([value, count]) => {
        let color: string | undefined;
        let label = value;

        if (options && Array.isArray(options)) {
            const option = options.find(o =>
                typeof o === 'object' ? o.value === value : o === value
            );
            if (option && typeof option === 'object') {
                color = option.color;
                label = option.label;
            }
        }

        return { label, value: count, color };
    });
}
