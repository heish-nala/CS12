-- 1. Create cohorts table
CREATE TABLE cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dso_id UUID NOT NULL REFERENCES dsos(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cohorts_dso_id ON cohorts(dso_id);

-- RLS
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cohorts for their DSOs"
    ON cohorts FOR SELECT
    USING (dso_id IN (SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text));

CREATE POLICY "Users can manage cohorts for their DSOs"
    ON cohorts FOR ALL
    USING (dso_id IN (SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')));

-- 2. Add cohort_id to data_tables and activities (nullable -- existing rows stay NULL until migrated)
ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;

-- 3. Auto-create "Cohort 1" for every existing DSO and link existing data
DO $$
DECLARE
    dso_record RECORD;
    new_cohort_id UUID;
BEGIN
    FOR dso_record IN SELECT id FROM dsos LOOP
        IF NOT EXISTS (SELECT 1 FROM cohorts WHERE dso_id = dso_record.id) THEN
            INSERT INTO cohorts (dso_id, name, status)
            VALUES (dso_record.id, 'Cohort 1', 'active')
            RETURNING id INTO new_cohort_id;

            UPDATE data_tables SET cohort_id = new_cohort_id
            WHERE client_id = dso_record.id AND cohort_id IS NULL;

            UPDATE activities SET cohort_id = new_cohort_id
            WHERE client_id = dso_record.id AND cohort_id IS NULL;
        END IF;
    END LOOP;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_cohorts_updated_at BEFORE UPDATE ON cohorts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
