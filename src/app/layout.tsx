import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { ClientsProvider } from "@/contexts/clients-context";
import { OrgProvider } from "@/contexts/org-context";
import { OnboardingProvider } from "@/contexts/onboarding-context";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingTour, OnboardingTrigger, OnboardingChecklist } from "@/components/onboarding";

export const metadata: Metadata = {
    title: "CS12 - Customer Success Platform",
    description: "Drive doctor engagement and success through data-driven insights and proactive support",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased">
                <AuthProvider>
                    <ClientsProvider>
                        <OrgProvider>
                            <OnboardingProvider>
                                <AuthGuard>
                                    <AppShell>{children}</AppShell>
                                    <OnboardingTrigger />
                                    <OnboardingTour />
                                    <OnboardingChecklist />
                                </AuthGuard>
                            </OnboardingProvider>
                        </OrgProvider>
                    </ClientsProvider>
                </AuthProvider>
                <Toaster />
            </body>
        </html>
    );
}
