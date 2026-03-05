-- Fix: restore missing metric IDs in attendee tracker time_tracking.metrics
-- and migrate period_data metrics keys from old random IDs.

-- Step 1: Restore deterministic metric IDs for any metric objects missing "id".
DO $$
DECLARE
    has_time_tracking BOOLEAN;
    tbl RECORD;
    updated_metrics JSONB;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'data_tables'
          AND column_name = 'time_tracking'
    ) INTO has_time_tracking;

    IF NOT has_time_tracking THEN
        RAISE NOTICE 'time_tracking column does not exist on data_tables, skipping metric ID restoration';
        RETURN;
    END IF;

    FOR tbl IN
        SELECT id, time_tracking
        FROM data_tables
        WHERE time_tracking IS NOT NULL
          AND time_tracking->'metrics' IS NOT NULL
          AND jsonb_typeof(time_tracking->'metrics') = 'array'
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(time_tracking->'metrics') AS m
              WHERE COALESCE(m->>'id', '') = ''
          )
    LOOP
        SELECT jsonb_agg(
            CASE
                WHEN COALESCE(m->>'id', '') <> '' THEN m
                WHEN lower(trim(COALESCE(m->>'name', ''))) = 'diagnosed' THEN
                    m || jsonb_build_object('id', 'metric-diagnosed')
                WHEN lower(trim(COALESCE(m->>'name', ''))) = 'scans' THEN
                    m || jsonb_build_object('id', 'metric-scans')
                WHEN lower(trim(COALESCE(m->>'name', ''))) = 'accepted' THEN
                    m || jsonb_build_object('id', 'metric-accepted')
                ELSE
                    m || jsonb_build_object(
                        'id',
                        'metric-' || lower(replace(trim(COALESCE(m->>'name', 'unknown')), ' ', '-'))
                    )
            END
            ORDER BY ord
        )
        INTO updated_metrics
        FROM jsonb_array_elements(tbl.time_tracking->'metrics') WITH ORDINALITY AS x(m, ord);

        UPDATE data_tables
        SET time_tracking = jsonb_set(time_tracking, '{metrics}', COALESCE(updated_metrics, '[]'::jsonb))
        WHERE id = tbl.id;
    END LOOP;
END $$;

-- Step 2: Re-key period_data.metrics from old random metric IDs to name-based IDs.
-- Old key format: metric-{timestamp}-{index}
-- Original index order: 0=Scans, 1=Accepted, 2=Diagnosed
DO $$
DECLARE
    has_time_tracking BOOLEAN;
    tbl RECORD;
    pd_row RECORD;
    old_key TEXT;
    new_key TEXT;
    new_metrics JSONB;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'data_tables'
          AND column_name = 'time_tracking'
    ) INTO has_time_tracking;

    IF NOT has_time_tracking THEN
        RAISE NOTICE 'time_tracking column does not exist on data_tables, skipping period_data key migration';
        RETURN;
    END IF;

    FOR tbl IN
        SELECT DISTINCT dt.id AS table_id
        FROM data_tables dt
        JOIN period_data pd ON pd.table_id = dt.id
        WHERE dt.time_tracking IS NOT NULL
          AND dt.time_tracking->'metrics' IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(dt.time_tracking->'metrics') AS m
              WHERE m->>'id' IN ('metric-diagnosed', 'metric-scans', 'metric-accepted')
          )
    LOOP
        FOR pd_row IN
            SELECT id, metrics
            FROM period_data
            WHERE table_id = tbl.table_id
              AND metrics IS NOT NULL
              AND metrics <> '{}'::jsonb
        LOOP
            new_metrics := '{}'::jsonb;

            FOR old_key IN SELECT jsonb_object_keys(pd_row.metrics)
            LOOP
                -- Keep already-migrated keys as-is.
                IF old_key IN ('metric-scans', 'metric-accepted', 'metric-diagnosed') THEN
                    new_key := old_key;
                -- Recover old random IDs by index suffix.
                ELSIF old_key ~ '^metric-[0-9]+-0$' THEN
                    new_key := 'metric-scans';
                ELSIF old_key ~ '^metric-[0-9]+-1$' THEN
                    new_key := 'metric-accepted';
                ELSIF old_key ~ '^metric-[0-9]+-2$' THEN
                    new_key := 'metric-diagnosed';
                ELSE
                    -- Preserve unknown keys (including any historical corruption like "undefined").
                    new_key := old_key;
                END IF;

                new_metrics := new_metrics || jsonb_build_object(new_key, pd_row.metrics->old_key);
            END LOOP;

            UPDATE period_data
            SET metrics = new_metrics
            WHERE id = pd_row.id;
        END LOOP;
    END LOOP;
END $$;
