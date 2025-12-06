'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { NotionSidebar } from '@/components/layout/notion-sidebar';

const publicPaths = ['/login'];

export function AppShell({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const pathname = usePathname();

    const isPublicPath = publicPaths.includes(pathname);
    const showSidebar = user && !isPublicPath;

    if (!showSidebar) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-background">
            <NotionSidebar />
            <main className="ml-60 overflow-y-auto">{children}</main>
        </div>
    );
}
