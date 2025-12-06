'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamMembers } from '@/components/settings/team-members';
import { Users, Settings as SettingsIcon, Bell } from 'lucide-react';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('team');

    return (
        <div className="flex-1 bg-background min-h-screen">
            {/* Notion-style Page Header */}
            <div className="px-24 pt-20 pb-4">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-[40px] font-bold tracking-tight text-foreground leading-[1.2] mb-2">
                        Settings
                    </h1>
                    <p className="text-[14px] text-muted-foreground">
                        Manage your workspace settings and team members
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="px-24 pb-24">
                <div className="max-w-4xl mx-auto">
                    {/* Settings Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList>
                            <TabsTrigger value="team" className="gap-2">
                                <Users className="h-4 w-4" />
                                Team
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

                        <TabsContent value="workspace" className="mt-0">
                            <div className="rounded-[3px] border border-border p-12 text-center">
                                <div className="w-12 h-12 rounded-[3px] bg-muted flex items-center justify-center mx-auto mb-4">
                                    <SettingsIcon className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <h3 className="text-[16px] font-semibold text-foreground mb-1">Workspace Settings</h3>
                                <p className="text-[14px] text-muted-foreground">
                                    Workspace configuration coming soon
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="notifications" className="mt-0">
                            <div className="rounded-[3px] border border-border p-12 text-center">
                                <div className="w-12 h-12 rounded-[3px] bg-muted flex items-center justify-center mx-auto mb-4">
                                    <Bell className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <h3 className="text-[16px] font-semibold text-foreground mb-1">Notification Settings</h3>
                                <p className="text-[14px] text-muted-foreground">
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
