'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/db/client';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string) => Promise<{ error: Error | null; needsConfirmation?: boolean }>;
    signInWithGoogle: () => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to check and accept pending invites
async function checkAndAcceptInvites(userId: string, email: string) {
    try {
        const response = await fetch('/api/team/accept-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, email }),
        });

        if (response.ok) {
            const data = await response.json();
            if (data.accepted_count > 0) {
                console.log(`Accepted ${data.accepted_count} invite(s):`, data.workspaces);
            }
        }
    } catch (error) {
        console.error('Error checking for pending invites:', error);
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const inviteCheckDone = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);

            // Check for pending invites on initial load
            if (session?.user?.id && session?.user?.email) {
                if (!inviteCheckDone.current.has(session.user.id)) {
                    inviteCheckDone.current.add(session.user.id);
                    checkAndAcceptInvites(session.user.id, session.user.email);
                }
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);

                // Check for pending invites on sign in
                if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user?.id && session?.user?.email) {
                    if (!inviteCheckDone.current.has(session.user.id)) {
                        inviteCheckDone.current.add(session.user.id);
                        checkAndAcceptInvites(session.user.id, session.user.email);
                    }
                }

                // Clear the check on sign out so it runs again on next sign in
                if (event === 'SIGNED_OUT') {
                    inviteCheckDone.current.clear();
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error };
    };

    const signUp = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });
        // If user exists but email not confirmed, or if confirmation is required
        const needsConfirmation = !error && data?.user && !data.session ? true : undefined;
        return { error, needsConfirmation };
    };

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/`,
            },
        });
        return { error };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
