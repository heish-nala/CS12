import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/db/client';

// Cookie configuration for Supabase SSR
function createSupabaseClient(request: NextRequest) {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll() {
                    // We don't need to set cookies in API routes
                },
            },
        }
    );
}

export interface AuthUser {
    id: string;
    email: string;
}

export interface AuthResult {
    user: AuthUser | null;
    error: string | null;
}

/**
 * Get the authenticated user from the request
 */
export async function getAuthUser(request: NextRequest): Promise<AuthResult> {
    try {
        const supabase = createSupabaseClient(request);
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            return { user: null, error: 'Not authenticated' };
        }

        return {
            user: {
                id: user.id,
                email: user.email || '',
            },
            error: null,
        };
    } catch (error) {
        console.error('Auth error:', error);
        return { user: null, error: 'Authentication failed' };
    }
}

/**
 * Check if user has access to a specific DSO/client
 */
export async function checkDsoAccess(
    userId: string,
    dsoId: string
): Promise<{ hasAccess: boolean; role: string | null }> {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_dso_access')
            .select('role')
            .eq('user_id', userId)
            .eq('dso_id', dsoId)
            .single();

        if (error || !data) {
            return { hasAccess: false, role: null };
        }

        return { hasAccess: true, role: data.role };
    } catch (error) {
        console.error('DSO access check error:', error);
        return { hasAccess: false, role: null };
    }
}

/**
 * Check if user has write access (admin or manager role)
 */
export function hasWriteAccess(role: string | null): boolean {
    return role === 'admin' || role === 'manager';
}

/**
 * Middleware helper to require authentication
 * Returns an error response if not authenticated, or the user if authenticated
 */
export async function requireAuth(request: NextRequest): Promise<
    { user: AuthUser; response?: never } | { user?: never; response: NextResponse }
> {
    const { user, error } = await getAuthUser(request);

    if (!user) {
        return {
            response: NextResponse.json(
                { error: error || 'Unauthorized' },
                { status: 401 }
            ),
        };
    }

    return { user };
}

/**
 * Middleware helper to require DSO access
 * Returns an error response if no access, or the access info if authorized
 */
export async function requireDsoAccess(
    request: NextRequest,
    dsoId: string,
    requireWrite = false
): Promise<
    { user: AuthUser; role: string; response?: never } | { user?: never; role?: never; response: NextResponse }
> {
    const { user, error } = await getAuthUser(request);

    if (!user) {
        return {
            response: NextResponse.json(
                { error: error || 'Unauthorized' },
                { status: 401 }
            ),
        };
    }

    const { hasAccess, role } = await checkDsoAccess(user.id, dsoId);

    if (!hasAccess) {
        return {
            response: NextResponse.json(
                { error: 'Access denied to this workspace' },
                { status: 403 }
            ),
        };
    }

    if (requireWrite && !hasWriteAccess(role)) {
        return {
            response: NextResponse.json(
                { error: 'Write access required' },
                { status: 403 }
            ),
        };
    }

    return { user, role: role! };
}
