'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from './auth-context';

interface Client {
    id: string;
    name: string;
    archived?: boolean;
}

interface ClientsContextType {
    clients: Client[];
    archivedClients: Client[];
    loading: boolean;
    refreshClients: () => Promise<void>;
    addClient: (client: Client) => void;
}

const ClientsContext = createContext<ClientsContextType | undefined>(undefined);

export function ClientsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [archivedClients, setArchivedClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchClients = useCallback(async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`/api/dsos?user_id=${user.id}&include_archived=true`);
            if (response.ok) {
                const data = await response.json();
                setClients(data.dsos || []);
                setArchivedClients(data.archivedDsos || []);
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const addClient = useCallback((client: Client) => {
        setClients(prev => [...prev, client]);
    }, []);

    return (
        <ClientsContext.Provider
            value={{
                clients,
                archivedClients,
                loading,
                refreshClients: fetchClients,
                addClient,
            }}
        >
            {children}
        </ClientsContext.Provider>
    );
}

export function useClients() {
    const context = useContext(ClientsContext);
    if (context === undefined) {
        throw new Error('useClients must be used within a ClientsProvider');
    }
    return context;
}
