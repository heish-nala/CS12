'use client';

import Link from 'next/link';

export function Header() {
    return (
        <header className="border-b border-border bg-background">
            <div className="container mx-auto px-6 py-3">
                <nav className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-[3px] bg-primary flex items-center justify-center text-primary-foreground text-[12px] font-semibold">
                                K
                            </div>
                            <span className="font-semibold text-[15px] text-foreground">Konekt</span>
                        </Link>
                        <div className="flex items-center gap-1">
                            <Link
                                href="/"
                                className="px-3 py-1.5 text-[14px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground rounded-[3px] transition-colors duration-75"
                            >
                                Clients
                            </Link>
                        </div>
                    </div>
                    <div className="text-[13px] text-muted-foreground">
                        Customer Success Platform
                    </div>
                </nav>
            </div>
        </header>
    );
}
