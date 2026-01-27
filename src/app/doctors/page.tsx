import { Suspense } from 'react';
import { DoctorsContent } from './doctors-content';
import { Stethoscope } from 'lucide-react';

export const dynamic = 'force-dynamic';

function LoadingSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-4 rounded-xl bg-card border border-border/50">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                                <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="h-12 bg-muted/30 border-b border-border/50" />
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 border-b border-border/50 flex items-center gap-4 px-4" style={{ opacity: 1 - i * 0.15 }}>
                        <div className="h-4 w-8 bg-muted animate-pulse rounded" />
                        <div className="h-4 flex-1 max-w-[150px] bg-muted animate-pulse rounded" />
                        <div className="h-4 flex-1 max-w-[100px] bg-muted/60 animate-pulse rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function DoctorsPage() {
    return (
        <div className="flex-1 bg-background min-h-screen">
            {/* Modern Header */}
            <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                <div className="px-6 lg:px-8 pt-8 pb-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Stethoscope className="w-4 h-4" />
                            <span>Management</span>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            Doctors
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage and track doctor onboarding progress
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 lg:px-8 py-6">
                <div className="max-w-6xl mx-auto">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <DoctorsContent />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
