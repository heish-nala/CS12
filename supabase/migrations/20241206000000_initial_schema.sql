-- CS12 Platform Database Schema
-- Customer Success Tracking for Doctor/Dentist Onboarding

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- DSO (Dental Service Organization) Table
CREATE TABLE dsos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctors/Clients Table
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dso_id UUID NOT NULL REFERENCES dsos(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    start_date DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Period Progress Table (Monthly Tracking)
CREATE TABLE period_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 12),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cases_submitted INTEGER DEFAULT 0,
    courses_completed INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, period_number)
);

-- Activities Table (Activity Logging)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'case_review', 'training', 'other')),
    description TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Groups/Phases Table
CREATE TABLE task_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Tasks Table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_group_id UUID NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-DSO Access Table (Permissions)
CREATE TABLE user_dso_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    dso_id UUID NOT NULL REFERENCES dsos(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, dso_id)
);

-- Dashboard Metric Configurations Table
CREATE TABLE dashboard_metric_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dso_id UUID NOT NULL REFERENCES dsos(id) ON DELETE CASCADE,
    metric_id TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dso_id, metric_id)
);

-- Client Terminology Configuration Table
CREATE TABLE client_terminology (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dso_id UUID NOT NULL REFERENCES dsos(id) ON DELETE CASCADE UNIQUE,
    -- Member/Unit terminology
    member_singular TEXT DEFAULT 'doctor',
    member_plural TEXT DEFAULT 'doctors',
    -- Activity terminology
    activity_singular TEXT DEFAULT 'activity',
    activity_plural TEXT DEFAULT 'activities',
    -- Primary metrics
    case_singular TEXT DEFAULT 'case',
    case_plural TEXT DEFAULT 'cases',
    course_singular TEXT DEFAULT 'course',
    course_plural TEXT DEFAULT 'courses',
    -- Category names
    category_overview TEXT DEFAULT 'Program Overview',
    category_engagement TEXT DEFAULT 'Engagement & Activity',
    category_performance TEXT DEFAULT 'Performance Metrics',
    -- Time period
    period_singular TEXT DEFAULT 'period',
    period_plural TEXT DEFAULT 'periods',
    -- Program/onboarding
    program_name TEXT DEFAULT 'program',
    onboarding_name TEXT DEFAULT 'onboarding',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_doctors_dso_id ON doctors(dso_id);
CREATE INDEX idx_doctors_status ON doctors(status);
CREATE INDEX idx_doctors_start_date ON doctors(start_date);
CREATE INDEX idx_period_progress_doctor_id ON period_progress(doctor_id);
CREATE INDEX idx_activities_doctor_id ON activities(doctor_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX idx_tasks_doctor_id ON tasks(doctor_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_user_dso_access_user_id ON user_dso_access(user_id);
CREATE INDEX idx_dashboard_metric_configs_dso_id ON dashboard_metric_configs(dso_id);
CREATE INDEX idx_client_terminology_dso_id ON client_terminology(dso_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_dsos_updated_at BEFORE UPDATE ON dsos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_period_progress_updated_at BEFORE UPDATE ON period_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_metric_configs_updated_at BEFORE UPDATE ON dashboard_metric_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_terminology_updated_at BEFORE UPDATE ON client_terminology
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE dsos ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dso_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_metric_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_terminology ENABLE ROW LEVEL SECURITY;

-- RLS Policies for doctors table
CREATE POLICY "Users can view doctors from their DSOs"
    ON doctors FOR SELECT
    USING (
        dso_id IN (
            SELECT dso_id FROM user_dso_access 
            WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert doctors to their DSOs"
    ON doctors FOR INSERT
    WITH CHECK (
        dso_id IN (
            SELECT dso_id FROM user_dso_access 
            WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can update doctors in their DSOs"
    ON doctors FOR UPDATE
    USING (
        dso_id IN (
            SELECT dso_id FROM user_dso_access 
            WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can delete doctors from their DSOs"
    ON doctors FOR DELETE
    USING (
        dso_id IN (
            SELECT dso_id FROM user_dso_access 
            WHERE user_id = auth.uid()::text AND role = 'admin'
        )
    );

-- RLS Policies for period_progress table
CREATE POLICY "Users can view period progress for their DSO doctors"
    ON period_progress FOR SELECT
    USING (
        doctor_id IN (
            SELECT id FROM doctors WHERE dso_id IN (
                SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can manage period progress for their DSO doctors"
    ON period_progress FOR ALL
    USING (
        doctor_id IN (
            SELECT id FROM doctors WHERE dso_id IN (
                SELECT dso_id FROM user_dso_access 
                WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
            )
        )
    );

-- RLS Policies for activities table
CREATE POLICY "Users can view activities for their DSO doctors"
    ON activities FOR SELECT
    USING (
        doctor_id IN (
            SELECT id FROM doctors WHERE dso_id IN (
                SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can create activities for their DSO doctors"
    ON activities FOR INSERT
    WITH CHECK (
        doctor_id IN (
            SELECT id FROM doctors WHERE dso_id IN (
                SELECT dso_id FROM user_dso_access 
                WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
            )
        )
    );

-- RLS Policies for DSOs
CREATE POLICY "Users can view their DSOs"
    ON dsos FOR SELECT
    USING (
        id IN (SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text)
    );

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks for their DSO doctors"
    ON tasks FOR SELECT
    USING (
        doctor_id IS NULL OR doctor_id IN (
            SELECT id FROM doctors WHERE dso_id IN (
                SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can manage tasks for their DSO doctors"
    ON tasks FOR ALL
    USING (
        doctor_id IS NULL OR doctor_id IN (
            SELECT id FROM doctors WHERE dso_id IN (
                SELECT dso_id FROM user_dso_access 
                WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
            )
        )
    );

-- Task groups are viewable by all authenticated users
CREATE POLICY "Authenticated users can view task groups"
    ON task_groups FOR SELECT
    TO authenticated
    USING (true);

-- User DSO access policies
CREATE POLICY "Users can view their own access"
    ON user_dso_access FOR SELECT
    USING (user_id = auth.uid()::text);

-- Dashboard metric configs policies
CREATE POLICY "Users can view dashboard configs for their DSOs"
    ON dashboard_metric_configs FOR SELECT
    USING (
        dso_id IN (SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text)
    );

CREATE POLICY "Users can manage dashboard configs for their DSOs"
    ON dashboard_metric_configs FOR ALL
    USING (
        dso_id IN (
            SELECT dso_id FROM user_dso_access
            WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
        )
    );

-- Client terminology policies
CREATE POLICY "Users can view terminology for their DSOs"
    ON client_terminology FOR SELECT
    USING (
        dso_id IN (SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text)
    );

CREATE POLICY "Users can manage terminology for their DSOs"
    ON client_terminology FOR ALL
    USING (
        dso_id IN (
            SELECT dso_id FROM user_dso_access
            WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
        )
    );

-- ============================================================================
-- FLEXIBLE DATA TABLES SYSTEM
-- ============================================================================

-- Data Tables (user-defined tables like "Doctors", "Accounts", etc.)
CREATE TABLE data_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES dsos(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'table', -- Lucide icon name
    color TEXT DEFAULT 'blue', -- Theme color
    is_template BOOLEAN DEFAULT FALSE,
    template_id TEXT, -- Reference to template type if created from template
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column type enum
CREATE TYPE column_type AS ENUM (
    'text',
    'number',
    'email',
    'phone',
    'url',
    'date',
    'datetime',
    'checkbox',
    'select',
    'multi_select',
    'status',
    'person',
    'currency',
    'percentage',
    'rating',
    'relationship'
);

-- Data Columns (user-defined columns for each table)
CREATE TABLE data_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type column_type NOT NULL DEFAULT 'text',
    -- Column configuration stored as JSONB for flexibility
    -- Examples: { options: ["Low", "Medium", "High"], colors: {...}, default_value: "Medium" }
    config JSONB DEFAULT '{}',
    is_required BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE, -- Primary display column (like "Name")
    width INTEGER DEFAULT 150,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Rows (the actual data entries)
CREATE TABLE data_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    -- All cell values stored as JSONB: { "column_id_1": "value1", "column_id_2": 123, ... }
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template definitions (pre-built templates for CS use cases)
CREATE TABLE data_templates (
    id TEXT PRIMARY KEY, -- e.g., 'doctors', 'accounts', 'health_scores'
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'table',
    color TEXT DEFAULT 'blue',
    category TEXT DEFAULT 'general', -- 'general', 'customer_success', 'sales', etc.
    -- Column definitions as JSONB array
    columns JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for flexible data tables
CREATE INDEX idx_data_tables_client_id ON data_tables(client_id);
CREATE INDEX idx_data_columns_table_id ON data_columns(table_id);
CREATE INDEX idx_data_rows_table_id ON data_rows(table_id);
CREATE INDEX idx_data_rows_data ON data_rows USING GIN(data);

-- Triggers for flexible data tables
CREATE TRIGGER update_data_tables_updated_at BEFORE UPDATE ON data_tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_columns_updated_at BEFORE UPDATE ON data_columns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_rows_updated_at BEFORE UPDATE ON data_rows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for flexible data tables
ALTER TABLE data_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view data tables for their clients"
    ON data_tables FOR SELECT
    USING (
        client_id IN (SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text)
    );

CREATE POLICY "Users can manage data tables for their clients"
    ON data_tables FOR ALL
    USING (
        client_id IN (
            SELECT dso_id FROM user_dso_access
            WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can view columns for their data tables"
    ON data_columns FOR SELECT
    USING (
        table_id IN (
            SELECT id FROM data_tables WHERE client_id IN (
                SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can manage columns for their data tables"
    ON data_columns FOR ALL
    USING (
        table_id IN (
            SELECT id FROM data_tables WHERE client_id IN (
                SELECT dso_id FROM user_dso_access
                WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
            )
        )
    );

CREATE POLICY "Users can view rows for their data tables"
    ON data_rows FOR SELECT
    USING (
        table_id IN (
            SELECT id FROM data_tables WHERE client_id IN (
                SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can manage rows for their data tables"
    ON data_rows FOR ALL
    USING (
        table_id IN (
            SELECT id FROM data_tables WHERE client_id IN (
                SELECT dso_id FROM user_dso_access
                WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
            )
        )
    );

CREATE POLICY "Anyone can view templates"
    ON data_templates FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================================
-- INSERT DEFAULT CS TEMPLATES
-- ============================================================================

INSERT INTO data_templates (id, name, description, icon, color, category, columns) VALUES
(
    'doctors',
    'Doctors / Providers',
    'Track healthcare providers through onboarding and engagement',
    'user-round',
    'blue',
    'customer_success',
    '[
        {"name": "Name", "type": "text", "is_primary": true, "is_required": true},
        {"name": "Email", "type": "email"},
        {"name": "Phone", "type": "phone"},
        {"name": "Start Date", "type": "date", "is_required": true},
        {"name": "Status", "type": "status", "config": {"options": [{"value": "active", "label": "Active", "color": "green"}, {"value": "at_risk", "label": "At Risk", "color": "orange"}, {"value": "inactive", "label": "Inactive", "color": "gray"}, {"value": "completed", "label": "Completed", "color": "blue"}]}},
        {"name": "Cases Submitted", "type": "number", "config": {"default_value": 0}},
        {"name": "Courses Completed", "type": "number", "config": {"default_value": 0}},
        {"name": "Last Contact", "type": "date"},
        {"name": "Notes", "type": "text"}
    ]'::jsonb
),
(
    'accounts',
    'Accounts',
    'Manage customer accounts and organizations',
    'building-2',
    'purple',
    'customer_success',
    '[
        {"name": "Account Name", "type": "text", "is_primary": true, "is_required": true},
        {"name": "Industry", "type": "select", "config": {"options": ["Healthcare", "Technology", "Finance", "Retail", "Other"]}},
        {"name": "Health Score", "type": "status", "config": {"options": [{"value": "healthy", "label": "Healthy", "color": "green"}, {"value": "neutral", "label": "Neutral", "color": "yellow"}, {"value": "at_risk", "label": "At Risk", "color": "red"}]}},
        {"name": "ARR", "type": "currency"},
        {"name": "Contract Start", "type": "date"},
        {"name": "Renewal Date", "type": "date"},
        {"name": "CSM", "type": "person"},
        {"name": "Notes", "type": "text"}
    ]'::jsonb
),
(
    'contacts',
    'Contacts',
    'Key contacts and stakeholders',
    'users',
    'green',
    'customer_success',
    '[
        {"name": "Name", "type": "text", "is_primary": true, "is_required": true},
        {"name": "Email", "type": "email", "is_required": true},
        {"name": "Phone", "type": "phone"},
        {"name": "Role", "type": "text"},
        {"name": "Company", "type": "text"},
        {"name": "Last Contact", "type": "date"},
        {"name": "Preferred Contact", "type": "select", "config": {"options": ["Email", "Phone", "Slack", "Other"]}},
        {"name": "Notes", "type": "text"}
    ]'::jsonb
),
(
    'touchpoints',
    'Touchpoints',
    'Log customer interactions and activities',
    'message-circle',
    'orange',
    'customer_success',
    '[
        {"name": "Subject", "type": "text", "is_primary": true, "is_required": true},
        {"name": "Type", "type": "select", "config": {"options": ["Call", "Email", "Meeting", "Training", "Support", "Other"]}, "is_required": true},
        {"name": "Date", "type": "datetime", "is_required": true},
        {"name": "Contact", "type": "text"},
        {"name": "Outcome", "type": "status", "config": {"options": [{"value": "positive", "label": "Positive", "color": "green"}, {"value": "neutral", "label": "Neutral", "color": "gray"}, {"value": "negative", "label": "Negative", "color": "red"}]}},
        {"name": "Follow-up Needed", "type": "checkbox"},
        {"name": "Notes", "type": "text"}
    ]'::jsonb
),
(
    'tasks',
    'Tasks',
    'Track action items and to-dos',
    'check-square',
    'indigo',
    'general',
    '[
        {"name": "Task", "type": "text", "is_primary": true, "is_required": true},
        {"name": "Status", "type": "status", "config": {"options": [{"value": "todo", "label": "To Do", "color": "gray"}, {"value": "in_progress", "label": "In Progress", "color": "blue"}, {"value": "done", "label": "Done", "color": "green"}]}},
        {"name": "Priority", "type": "select", "config": {"options": ["Low", "Medium", "High", "Urgent"]}},
        {"name": "Due Date", "type": "date"},
        {"name": "Assignee", "type": "person"},
        {"name": "Completed", "type": "checkbox"},
        {"name": "Notes", "type": "text"}
    ]'::jsonb
);
