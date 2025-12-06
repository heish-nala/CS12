import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { NotionSidebar } from "@/components/layout/notion-sidebar";

export const metadata: Metadata = {
    title: "Konekt - Customer Success Platform",
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
                <div className="min-h-screen bg-background">
                    <NotionSidebar />
                    <main className="ml-60 overflow-y-auto">{children}</main>
                </div>
                <Toaster />
            </body>
        </html>
    );
}
