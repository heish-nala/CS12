'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { toast } from 'sonner';
import { Building2, Mail, User } from 'lucide-react';

interface CreateClientDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateClientDialog({
    open,
    onOpenChange,
}: CreateClientDialogProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        industry: '',
        contact_name: '',
        contact_email: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);

        try {
            // TODO: Replace with actual API call
            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error('Failed to create client');
            }

            const data = await response.json();

            toast.success('Client created successfully');

            // Reset form
            setFormData({
                name: '',
                industry: '',
                contact_name: '',
                contact_email: '',
            });

            onOpenChange(false);

            // Navigate to the new client page
            if (data.client?.id) {
                router.push(`/clients/${data.client.id}`);
            }
        } catch (error) {
            console.error('Error creating client:', error);
            toast.error('Failed to create client');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create New Client</DialogTitle>
                    <DialogDescription>
                        Add a new client to your workspace
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 p-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="client-name">
                                <Building2 className="h-4 w-4 inline mr-2" />
                                Client Name *
                            </Label>
                            <Input
                                id="client-name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Acme Dental Group"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="industry">Industry / Type</Label>
                            <Input
                                id="industry"
                                value={formData.industry}
                                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                placeholder="e.g., Dental Services, Healthcare"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contact-name">
                                <User className="h-4 w-4 inline mr-2" />
                                Primary Contact Name
                            </Label>
                            <Input
                                id="contact-name"
                                value={formData.contact_name}
                                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                placeholder="e.g., John Smith"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contact-email">
                                <Mail className="h-4 w-4 inline mr-2" />
                                Contact Email
                            </Label>
                            <Input
                                id="contact-email"
                                type="email"
                                value={formData.contact_email}
                                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                placeholder="john@example.com"
                            />
                        </div>
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
                            {loading ? 'Creating...' : 'Create Client'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
