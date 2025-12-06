'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

const publicPaths = ['/login'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            const isPublicPath = publicPaths.includes(pathname);

            if (!user && !isPublicPath) {
                router.push('/login');
            } else if (user && pathname === '/login') {
                router.push('/');
            }
        }
    }, [user, loading, pathname, router]);

    // Show loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    // Show children for public paths or authenticated users
    const isPublicPath = publicPaths.includes(pathname);
    if (isPublicPath || user) {
        return <>{children}</>;
    }

    // Return null while redirecting
    return null;
}
