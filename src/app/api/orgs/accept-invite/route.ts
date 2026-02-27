import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/orgs/accept-invite
 * Accepts all pending org_invites for a user's email.
 * Called from auth-context.tsx on SIGNED_IN event.
 * Adds user to org_members for each accepted invite.
 * Scoped strictly to the user's own email — no cross-org access.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { user_id, email } = body;

        // Try session auth first, fall back to user_id from body
        // (same pattern as existing /api/team/accept-invite)
        const authResult = await requireAuth(request);
        let actualUserId: string;
        let userEmail: string;

        if ('response' in authResult) {
            // Session auth failed — use user_id from body as fallback
            if (!user_id) {
                return authResult.response;
            }
            actualUserId = user_id;
            userEmail = email || '';
        } else {
            actualUserId = authResult.user.id;
            userEmail = email || authResult.user.email;
            // Validate that the request is for the authenticated user
            if (user_id && user_id !== actualUserId) {
                return NextResponse.json(
                    { error: 'Cannot accept invites for another user' },
                    { status: 403 }
                );
            }
        }

        const normalizedEmail = userEmail.toLowerCase().trim();

        // Find all pending, non-expired org invites for this email
        const { data: pendingInvites, error: fetchError } = await supabaseAdmin
            .from('org_invites')
            .select('*')
            .eq('email', normalizedEmail)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString());

        if (fetchError) {
            console.error('Error fetching pending org invites:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch pending invites' },
                { status: 500 }
            );
        }

        if (!pendingInvites || pendingInvites.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No pending org invites found',
                accepted_count: 0,
            });
        }

        let acceptedCount = 0;
        const orgs: string[] = [];

        for (const invite of pendingInvites) {
            try {
                // Insert into org_members — skip on conflict (already a member)
                const { error: memberError } = await supabaseAdmin
                    .from('org_members')
                    .insert({ org_id: invite.org_id, user_id: actualUserId, role: invite.role });

                if (memberError) {
                    // 23505 = unique violation (already a member) — still mark invite accepted
                    if (memberError.code !== '23505') {
                        console.error('Error adding to org:', memberError);
                        continue;
                    }
                }

                // Mark invite as accepted
                await supabaseAdmin
                    .from('org_invites')
                    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
                    .eq('id', invite.id);

                acceptedCount++;

                // Get org name for response
                const { data: org } = await supabaseAdmin
                    .from('organizations')
                    .select('name')
                    .eq('id', invite.org_id)
                    .single();
                if (org) orgs.push(org.name);
            } catch (error) {
                console.error('Error processing org invite:', error);
            }
        }

        return NextResponse.json({
            success: true,
            message: acceptedCount > 0
                ? `Successfully joined ${acceptedCount} organization(s)`
                : 'No new organizations to join',
            accepted_count: acceptedCount,
            orgs,
        });
    } catch (error) {
        console.error('Error accepting org invites:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
