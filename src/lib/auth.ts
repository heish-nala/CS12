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
 * Middleware helper to require authentication with user_id param fallback
 * Tries session auth first, falls back to user_id query param for GET requests
 */
export async function requireAuthWithFallback(request: NextRequest): Promise<
    { userId: string; response?: never } | { userId?: never; response: NextResponse }
> {
    const { user } = await getAuthUser(request);

    if (user) {
        return { userId: user.id };
    }

    // Fallback to user_id param for GET requests
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('user_id');

    if (userIdParam) {
        return { userId: userIdParam };
    }

    return {
        response: NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        ),
    };
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

/**
 * Middleware helper to require DSO access with user_id fallback
 * Tries session auth first, falls back to user_id from:
 * - Query params (for all requests)
 * - Request body (for POST/PUT/PATCH - pass parsedBody if already parsed)
 */
export async function requireDsoAccessWithFallback(
    request: NextRequest,
    dsoId: string,
    requireWrite = false,
    parsedBody?: { user_id?: string }
): Promise<
    { userId: string; role: string; response?: never } | { userId?: never; role?: never; response: NextResponse }
> {
    // Try session auth first
    const { user } = await getAuthUser(request);
    let userId: string;

    if (user) {
        userId = user.id;
    } else {
        // Fallback to user_id from query params (works for all methods including DELETE)
        const { searchParams } = new URL(request.url);
        const userIdParam = searchParams.get('user_id');

        if (userIdParam) {
            userId = userIdParam;
        } else if (parsedBody?.user_id) {
            // Fallback to user_id from parsed body (for POST/PUT/PATCH)
            userId = parsedBody.user_id;
        } else {
            return {
                response: NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                ),
            };
        }
    }

    const { hasAccess, role } = await checkDsoAccess(userId, dsoId);

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

    return { userId, role: role! };
}

/**
 * Check if user is a member of a specific organization
 */
export async function checkOrgMembership(
    userId: string,
    orgId: string
): Promise<{ isMember: boolean; role: string | null }> {
    try {
        const { data, error } = await supabaseAdmin
            .from('org_members')
            .select('role')
            .eq('user_id', userId)
            .eq('org_id', orgId)
            .single();

        if (error || !data) {
            return { isMember: false, role: null };
        }
        return { isMember: true, role: data.role };
    } catch (error) {
        console.error('Org membership check error:', error);
        return { isMember: false, role: null };
    }
}

/**
 * Middleware helper to require organization membership
 * Returns an error response if not a member, or the user + role if authorized
 */
export async function requireOrgAccess(
    request: NextRequest,
    orgId: string,
    requireOwnerOrAdmin = false
): Promise<
    { user: AuthUser; role: string; response?: never } |
    { user?: never; role?: never; response: NextResponse }
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

    const { isMember, role } = await checkOrgMembership(user.id, orgId);

    if (!isMember) {
        return {
            response: NextResponse.json(
                { error: 'Not a member of this organization' },
                { status: 403 }
            ),
        };
    }

    if (requireOwnerOrAdmin && role !== 'owner' && role !== 'admin') {
        return {
            response: NextResponse.json(
                { error: 'Owner or admin access required' },
                { status: 403 }
            ),
        };
    }

    return { user, role: role! };
}
