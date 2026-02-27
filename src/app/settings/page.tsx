'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamMembers } from '@/components/settings/team-members';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/contexts/onboarding-context';
import { OrgSettings } from '@/components/settings/org-settings';
import { Users, Settings as SettingsIcon, Bell, PlayCircle, Cog, Building2 } from 'lucide-react';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('team');
    const { resetOnboarding } = useOnboarding();

    return (
        <div className="flex-1 bg-background min-h-screen">
            {/* Modern Header */}
            <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                <div className="px-6 lg:px-8 pt-8 pb-6">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Cog className="w-4 h-4" />
                            <span>Configuration</span>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            Settings
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage your organization, workspace settings, and team members
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 lg:px-8 py-6">
                <div className="max-w-5xl mx-auto">
                    {/* Settings Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList>
                            <TabsTrigger value="team" className="gap-2">
                                <Users className="h-4 w-4" />
                                Team
                            </TabsTrigger>
                            <TabsTrigger value="organization" className="gap-2">
                                <Building2 className="h-4 w-4" />
                                Organization
                            </TabsTrigger>
                            <TabsTrigger value="workspace" className="gap-2">
                                <SettingsIcon className="h-4 w-4" />
                                Workspace
                            </TabsTrigger>
                            <TabsTrigger value="notifications" className="gap-2">
                                <Bell className="h-4 w-4" />
                                Notifications
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="team" className="mt-0">
                            <TeamMembers />
                        </TabsContent>

                        <TabsContent value="organization" className="mt-0">
                            <OrgSettings />
                        </TabsContent>

                        <TabsContent value="workspace" className="mt-0">
                            <div className="space-y-4">
                                {/* Onboarding Tour */}
                                <div className="rounded-xl border border-border/50 p-6 bg-card shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
                                            <PlayCircle className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-foreground mb-1">
                                                Product Tour
                                            </h3>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Restart the guided tour to learn about key features like creating clients, adding data tables, using templates, and progress tracking.
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={resetOnboarding}
                                                className="shadow-sm"
                                            >
                                                <PlayCircle className="h-4 w-4 mr-2" />
                                                Restart Tour
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Placeholder for other settings */}
                                <div className="rounded-xl border border-dashed border-border/70 bg-gradient-to-br from-muted/20 to-muted/5 p-12 text-center">
                                    <div className="p-3 rounded-xl bg-muted/50 inline-block mb-4">
                                        <SettingsIcon className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <h3 className="font-semibold text-foreground mb-1">More Settings</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Additional workspace configuration coming soon
                                    </p>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="notifications" className="mt-0">
                            <div className="rounded-xl border border-dashed border-border/70 bg-gradient-to-br from-muted/20 to-muted/5 p-12 text-center">
                                <div className="p-3 rounded-xl bg-muted/50 inline-block mb-4">
                                    <Bell className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <h3 className="font-semibold text-foreground mb-1">Notification Settings</h3>
                                <p className="text-sm text-muted-foreground">
                                    Notification preferences coming soon
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
