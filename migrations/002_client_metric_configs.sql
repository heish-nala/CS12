-- Migration: Create client_metric_configs table
-- Description: Stores which metrics are enabled for each client
-- Date: 2024-11-28

-- Create client_metric_configs table
CREATE TABLE IF NOT EXISTS client_metric_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    metric_id TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, metric_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_client_metric_configs_client_id
    ON client_metric_configs(client_id);

-- Create index for enabled metrics
CREATE INDEX IF NOT EXISTS idx_client_metric_configs_enabled
    ON client_metric_configs(client_id, enabled)
    WHERE enabled = true;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_client_metric_configs_updated_at ON client_metric_configs;

CREATE TRIGGER update_client_metric_configs_updated_at
    BEFORE UPDATE ON client_metric_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE client_metric_configs IS 'Stores metric configuration (enabled/disabled, order) for each client';
