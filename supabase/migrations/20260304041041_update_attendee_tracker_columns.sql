-- Migration: Update Attendee Tracker tables
-- Items 1-3 from implementation plan:
--   1. Add "Role" column (Doctor, Leadership, Staff, Other)
--   2. Update Status options (Not Started, Active, Completed, On Hold, Withdrawn)
--   3. Reorder time-tracking metrics + add "Cases Submitted"
--
-- Identifies Attendee Tracker tables by having both "Blueprint" and "Status" columns.

DO $$
DECLARE
    tbl RECORD;
    status_col_id UUID;
    phone_order INT;
BEGIN
    -- Find all Attendee Tracker tables (tables with both Blueprint and Status columns)
    FOR tbl IN
        SELECT DISTINCT dt.id AS table_id
        FROM data_tables dt
        JOIN data_columns dc1 ON dc1.table_id = dt.id AND dc1.name = 'Blueprint'
        JOIN data_columns dc2 ON dc2.table_id = dt.id AND dc2.name = 'Status'
    LOOP
        -- ============================================================
        -- 1. ADD ROLE COLUMN (after Phone, before Blueprint)
        -- ============================================================
        IF NOT EXISTS (
            SELECT 1 FROM data_columns WHERE table_id = tbl.table_id AND name = 'Role'
        ) THEN
            -- Find Phone column's order_index
            SELECT COALESCE(order_index, 2) INTO phone_order
            FROM data_columns
            WHERE table_id = tbl.table_id AND name = 'Phone';

            -- Shift all columns after Phone up by 1
            UPDATE data_columns
            SET order_index = order_index + 1
            WHERE table_id = tbl.table_id
            AND order_index > phone_order;

            -- Insert Role column right after Phone
            INSERT INTO data_columns (table_id, name, type, config, order_index, is_primary, is_required)
            VALUES (
                tbl.table_id,
                'Role',
                'status',
                '{
                    "options": [
                        {"id": "r1", "value": "doctor", "label": "Doctor", "color": "blue", "group": "in_progress"},
                        {"id": "r2", "value": "leadership", "label": "Leadership", "color": "purple", "group": "in_progress"},
                        {"id": "r3", "value": "staff", "label": "Staff", "color": "green", "group": "in_progress"},
                        {"id": "r4", "value": "other", "label": "Other", "color": "gray", "group": "in_progress"}
                    ]
                }'::jsonb,
                phone_order + 1,
                false,
                false
            );
        END IF;

        -- ============================================================
        -- 2. UPDATE STATUS COLUMN OPTIONS
        -- ============================================================
        -- Get the Status column ID for this table
        SELECT id INTO status_col_id
        FROM data_columns
        WHERE table_id = tbl.table_id AND name = 'Status';

        IF status_col_id IS NOT NULL THEN
            -- Update the config with new status options
            UPDATE data_columns
            SET config = '{
                "options": [
                    {"id": "s1", "value": "not_started", "label": "Not Started", "color": "gray", "group": "todo"},
                    {"id": "s2", "value": "active", "label": "Active", "color": "blue", "group": "in_progress"},
                    {"id": "s3", "value": "completed", "label": "Completed", "color": "green", "group": "complete"},
                    {"id": "s4", "value": "on_hold", "label": "On Hold", "color": "yellow", "group": "in_progress"},
                    {"id": "s5", "value": "withdrawn", "label": "Withdrawn", "color": "red", "group": "complete"}
                ]
            }'::jsonb
            WHERE id = status_col_id;

            -- Migrate existing row data: 'at_risk' → 'active', 'inactive' → 'withdrawn'
            UPDATE data_rows
            SET data = jsonb_set(data, ARRAY[status_col_id::text], '"active"')
            WHERE table_id = tbl.table_id
            AND data->>status_col_id::text = 'at_risk';

            UPDATE data_rows
            SET data = jsonb_set(data, ARRAY[status_col_id::text], '"withdrawn"')
            WHERE table_id = tbl.table_id
            AND data->>status_col_id::text = 'inactive';
        END IF;

        -- ============================================================
        -- 3. REORDER TIME-TRACKING METRICS + ADD CASES SUBMITTED
        -- ============================================================
        -- Clinical funnel order: Diagnosed → Scans → Accepted → Cases Submitted
        UPDATE data_tables
        SET time_tracking = jsonb_set(
            time_tracking,
            '{metrics}',
            '[
                {"name": "Diagnosed", "type": "number"},
                {"name": "Scans", "type": "number"},
                {"name": "Accepted", "type": "number"},
                {"name": "Cases Submitted", "type": "number"}
            ]'::jsonb
        )
        WHERE id = tbl.table_id
        AND time_tracking IS NOT NULL;

    END LOOP;
END $$;
