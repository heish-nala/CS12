'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Doctor, DSO } from '@/lib/db/types';
import { toast } from 'sonner';

interface EditDoctorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    doctor?: Doctor;
    onSuccess?: () => void;
}

export function EditDoctorDialog({
    open,
    onOpenChange,
    doctor,
    onSuccess,
}: EditDoctorDialogProps) {
    const [loading, setLoading] = useState(false);
    const [dsos, setDsos] = useState<DSO[]>([]);
    const [formData, setFormData] = useState({
        dso_id: '',
        name: '',
        email: '',
        phone: '',
        start_date: '',
        notes: '',
    });

    useEffect(() => {
        if (open) {
            fetchDSOs();
            if (doctor) {
                setFormData({
                    dso_id: doctor.dso_id,
                    name: doctor.name,
                    email: doctor.email || '',
                    phone: doctor.phone || '',
                    start_date: doctor.start_date,
                    notes: doctor.notes || '',
                });
            } else {
                resetForm();
            }
        }
    }, [open, doctor]);

    const fetchDSOs = async () => {
        try {
            const response = await fetch('/api/dsos');
            const data = await response.json();
            setDsos(data.dsos || []);
        } catch (error) {
            console.error('Error fetching DSOs:', error);
            toast.error('Failed to load DSOs');
        }
    };

    const resetForm = () => {
        setFormData({
            dso_id: '',
            name: '',
            email: '',
            phone: '',
            start_date: new Date().toISOString().split('T')[0],
            notes: '',
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const url = doctor ? `/api/doctors/${doctor.id}` : '/api/doctors';
            const method = doctor ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save doctor');
            }

            toast.success(doctor ? 'Doctor updated successfully' : 'Doctor created successfully');
            onOpenChange(false);
            onSuccess?.();
        } catch (error) {
            console.error('Error saving doctor:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save doctor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{doctor ? 'Edit Doctor' : 'Add New Doctor'}</DialogTitle>
                    <DialogDescription>
                        {doctor
                            ? 'Update doctor information and onboarding details.'
                            : 'Add a new doctor to the onboarding program.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 p-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="dso">DSO *</Label>
                        <Select
                            value={formData.dso_id}
                            onValueChange={(value) =>
                                setFormData({ ...formData, dso_id: value })
                            }
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a DSO" />
                            </SelectTrigger>
                            <SelectContent>
                                {dsos.map((dso) => (
                                    <SelectItem key={dso.id} value={dso.id}>
                                        {dso.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({ ...formData, name: e.target.value })
                            }
                            placeholder="Dr. John Doe"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({ ...formData, email: e.target.value })
                                }
                                placeholder="john.doe@example.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) =>
                                    setFormData({ ...formData, phone: e.target.value })
                                }
                                placeholder="555-0123"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="start_date">Start Date *</Label>
                        <Input
                            id="start_date"
                            type="date"
                            value={formData.start_date}
                            onChange={(e) =>
                                setFormData({ ...formData, start_date: e.target.value })
                            }
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) =>
                                setFormData({ ...formData, notes: e.target.value })
                            }
                            placeholder="Additional notes about the doctor..."
                            rows={3}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : doctor ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
