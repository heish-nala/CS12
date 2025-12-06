'use client';

import { useSearchParams } from 'next/navigation';
import { DoctorTracker } from '@/components/doctors/doctor-tracker';

export function DoctorsContent() {
    const searchParams = useSearchParams();
    const dsoId = searchParams.get('dso_id') || undefined;

    return <DoctorTracker dsoId={dsoId} />;
}
