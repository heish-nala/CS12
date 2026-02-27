'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from './auth-context';
import { Organization, OrgRole } from '@/lib/db/types';

interface OrgWithRole extends Organization {
    role: OrgRole;
}

interface OrgContextType {
    org: OrgWithRole | null;
    loading: boolean;
    refreshOrg: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [org, setOrg] = useState<OrgWithRole | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchOrg = useCallback(async () => {
        if (!user?.id) {
            // Only set loading to false if auth is done and there's no user
            if (!authLoading) {
                setLoading(false);
            }
            return;
        }

        try {
            const response = await fetch('/api/orgs');
            if (response.ok) {
                const data = await response.json();
                if (data.orgs?.length > 1) {
                    console.warn('User has multiple orgs — using first. Multi-org support is v2 (MORG-02).');
                }
                setOrg(data.orgs?.[0] ?? null);
            }
        } catch (error) {
            console.error('Error fetching org:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id, authLoading]);

    useEffect(() => {
        // Only fetch when auth is done loading AND we have a user
        if (!authLoading && user?.id) {
            fetchOrg();
        } else if (!authLoading && !user?.id) {
            // Auth done but no user - stop loading
            setLoading(false);
        }
    }, [user?.id, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <OrgContext.Provider value={{ org, loading, refreshOrg: fetchOrg }}>
            {children}
        </OrgContext.Provider>
    );
}

export function useOrg() {
    const context = useContext(OrgContext);
    if (context === undefined) {
        throw new Error('useOrg must be used within an OrgProvider');
    }
    return context;
}
