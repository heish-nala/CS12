'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getDefaultMetrics } from '@/lib/metrics/metric-library';

// Pre-computed default values to avoid recreation on every render
const DEFAULT_METRICS = getDefaultMetrics();
const DEFAULT_ENABLED_SET = new Set(DEFAULT_METRICS);
const DEFAULT_CONFIGS = DEFAULT_METRICS.map((metricId, index) => ({
    metric_id: metricId,
    enabled: true,
    order_index: index,
}));
const DEFAULT_IS_ENABLED = (metricId: string) => DEFAULT_METRICS.includes(metricId);
const DEFAULT_CONTEXT_VALUE = {
    enabledMetrics: DEFAULT_ENABLED_SET,
    metricConfigs: DEFAULT_CONFIGS,
    loading: false,
    refresh: async () => {},
    isMetricEnabled: DEFAULT_IS_ENABLED,
};

export interface MetricConfig {
    metric_id: string;
    enabled: boolean;
    order_index: number;
}

interface MetricConfigContextValue {
    enabledMetrics: Set<string>;
    metricConfigs: MetricConfig[];
    loading: boolean;
    refresh: () => Promise<void>;
    isMetricEnabled: (metricId: string) => boolean;
}

const MetricConfigContext = createContext<MetricConfigContextValue | undefined>(undefined);

interface MetricConfigProviderProps {
    children: React.ReactNode;
    clientId: string;
}

export function MetricConfigProvider({ children, clientId }: MetricConfigProviderProps) {
    const [metricConfigs, setMetricConfigs] = useState<MetricConfig[]>([]);
    const [enabledMetrics, setEnabledMetrics] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    const loadMetricConfig = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/metrics/config?client_id=${clientId}`);
            const data = await response.json();

            if (data.configs && data.configs.length > 0) {
                setMetricConfigs(data.configs);
                const enabled = new Set<string>(
                    data.configs
                        .filter((c: MetricConfig) => c.enabled)
                        .map((c: MetricConfig) => c.metric_id)
                );
                setEnabledMetrics(enabled);
            } else {
                // Use defaults
                const defaults = getDefaultMetrics();
                setEnabledMetrics(new Set(defaults));
                setMetricConfigs(
                    defaults.map((metricId, index) => ({
                        metric_id: metricId,
                        enabled: true,
                        order_index: index,
                    }))
                );
            }
        } catch (error) {
            console.error('Error loading metric config:', error);
            // Fall back to defaults on error
            const defaults = getDefaultMetrics();
            setEnabledMetrics(new Set(defaults));
            setMetricConfigs(
                defaults.map((metricId, index) => ({
                    metric_id: metricId,
                    enabled: true,
                    order_index: index,
                }))
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (clientId) {
            loadMetricConfig();
        }
    }, [clientId]);

    const isMetricEnabled = (metricId: string): boolean => {
        return enabledMetrics.has(metricId);
    };

    const value: MetricConfigContextValue = {
        enabledMetrics,
        metricConfigs,
        loading,
        refresh: loadMetricConfig,
        isMetricEnabled,
    };

    return (
        <MetricConfigContext.Provider value={value}>
            {children}
        </MetricConfigContext.Provider>
    );
}

export function useMetricConfig() {
    const context = useContext(MetricConfigContext);
    if (context === undefined) {
        throw new Error('useMetricConfig must be used within a MetricConfigProvider');
    }
    return context;
}

// Optional: Hook that provides defaults if not in provider
// Uses pre-computed static values to avoid creating new objects on each render
export function useMetricConfigOrDefault() {
    const context = useContext(MetricConfigContext);
    // Return static default if no provider - avoids recreating objects
    return context ?? DEFAULT_CONTEXT_VALUE;
}
