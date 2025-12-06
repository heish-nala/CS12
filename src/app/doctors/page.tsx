'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DoctorTracker } from '@/components/doctors/doctor-tracker';

export const dynamic = 'force-dynamic';

function DoctorsContent() {
    const searchParams = useSearchParams();
    const dsoId = searchParams.get('dso_id') || undefined;

    return <DoctorTracker dsoId={dsoId} />;
}

export default function DoctorsPage() {
    return (
        <div className="container mx-auto py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Doctors</h1>
                <p className="text-muted-foreground">
                    Manage and track doctor onboarding progress
                </p>
            </div>

            <Suspense fallback={<div>Loading...</div>}>
                <DoctorsContent />
            </Suspense>
        </div>
    );
}
