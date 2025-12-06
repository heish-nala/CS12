import { Suspense } from 'react';
import { DoctorsContent } from './doctors-content';

export const dynamic = 'force-dynamic';

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
