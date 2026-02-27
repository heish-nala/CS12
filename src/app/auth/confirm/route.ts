import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /auth/confirm
 * Handles the invite email link from Supabase Auth.
 * The link contains token_hash and type=invite.
 * Uses verifyOtp (NOT exchangeCodeForSession — Supabase does not support PKCE for invite links).
 * On success, session is established and user is redirected into the app.
 * auth-context.tsx will fire SIGNED_IN → checkAndAcceptOrgInvites → user added to org_members.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') as EmailOtpType | null;
    const next = searchParams.get('next') ?? '/';

    if (token_hash && type) {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    },
                },
            }
        );

        const { error } = await supabase.auth.verifyOtp({ type, token_hash });

        if (!error) {
            // Session established — redirect to app
            // auth-context.tsx will fire SIGNED_IN → checkAndAcceptOrgInvites
            return NextResponse.redirect(
                new URL(next.startsWith('/') ? next : '/', request.url)
            );
        }
    }

    // Invalid or expired token — redirect to login with error
    return NextResponse.redirect(new URL('/login?error=invalid_invite', request.url));
}
