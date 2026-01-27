'use client';

import { ClientsOverview } from '@/components/clients/clients-overview';

export default function Home() {
    return (
        <div className="flex-1 bg-background min-h-screen">
            {/* Modern Header */}
            <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                <div className="px-6 lg:px-8 pt-8 pb-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Live
                            </span>
                            <span className="text-border">•</span>
                            <span>Customer Success</span>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            Dashboard
                        </h1>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 lg:px-8 py-6">
                <div className="max-w-6xl mx-auto">
                    <ClientsOverview />
                </div>
            </div>
        </div>
    );
}
