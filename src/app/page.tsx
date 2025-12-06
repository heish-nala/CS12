'use client';

import { ClientsOverview } from '@/components/clients/clients-overview';

export default function Home() {
    return (
        <div className="flex-1 bg-background min-h-screen">
            {/* Notion-style Page Header */}
            <div className="px-24 pt-20 pb-4">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-[40px] font-bold tracking-tight text-foreground leading-[1.2] mb-2">
                        Home
                    </h1>
                    <p className="text-[14px] text-muted-foreground">
                        Welcome to your customer success workspace
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="px-24 pb-24">
                <div className="max-w-5xl mx-auto">
                    <ClientsOverview />
                </div>
            </div>
        </div>
    );
}
