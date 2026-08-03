-- Migration: Add mentorship call tracking to period_data
-- One mentorship call per doctor per month. A non-null date means the call
-- happened that month; NULL means not (yet) done. Nullable with no default,
-- so this is a metadata-only change — no table rewrite, no impact on
-- existing rows or queries.

ALTER TABLE period_data ADD COLUMN mentorship_call_date DATE;

COMMENT ON COLUMN period_data.mentorship_call_date IS
    'Date of the monthly mentorship call for this row''s period. NULL = call not logged.';
