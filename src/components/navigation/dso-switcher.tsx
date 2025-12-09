'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { DSO } from '@/lib/db/types';
import { useAuth } from '@/contexts/auth-context';

export function DSOSwitcher() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const [dsos, setDsos] = useState<DSO[]>([]);
    const [loading, setLoading] = useState(true);
    const currentDsoId = searchParams.get('dso_id') || 'all';

    useEffect(() => {
        if (user?.id) {
            fetchDSOs();
        }
    }, [user?.id]);

    const fetchDSOs = async () => {
        if (!user?.id) return;

        try {
            const response = await fetch(`/api/dsos?user_id=${user.id}`);
            const data = await response.json();
            setDsos(data.dsos || []);
        } catch (error) {
            console.error('Error fetching DSOs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDSOChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());

        if (value === 'all') {
            params.delete('dso_id');
        } else {
            params.set('dso_id', value);
        }

        const newPath = window.location.pathname + (params.toString() ? `?${params}` : '');
        router.push(newPath);
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div className="h-8 w-32 bg-muted animate-pulse rounded-md" />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={currentDsoId} onValueChange={handleDSOChange}>
                <SelectTrigger className="w-[180px]" size="sm">
                    <SelectValue placeholder="Select DSO" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All DSOs</SelectItem>
                    {dsos.map((dso) => (
                        <SelectItem key={dso.id} value={dso.id}>
                            {dso.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
