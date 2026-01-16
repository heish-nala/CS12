import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

// POST: Accept pending invites for the current user
// Called when a user logs in to check and accept any pending invites
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { user_id, email } = body;

        if (!user_id || !email) {
            return NextResponse.json(
                { error: 'user_id and email are required' },
                { status: 400 }
            );
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Find all pending, non-expired invites for this email
        const { data: pendingInvites, error: fetchError } = await supabaseAdmin
            .from('team_invites')
            .select('*')
            .eq('email', normalizedEmail)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString());

        if (fetchError) {
            console.error('Error fetching pending invites:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch pending invites' },
                { status: 500 }
            );
        }

        if (!pendingInvites || pendingInvites.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No pending invites found',
                accepted_count: 0,
            });
        }

        let acceptedCount = 0;
        const acceptedWorkspaces: string[] = [];

        // Process each pending invite
        for (const invite of pendingInvites) {
            try {
                // Check if user already has access to this DSO
                const { data: existingAccess } = await supabaseAdmin
                    .from('user_dso_access')
                    .select('id')
                    .eq('user_id', user_id)
                    .eq('dso_id', invite.dso_id)
                    .single();

                if (!existingAccess) {
                    // Add user to the DSO with the invited role
                    const { error: accessError } = await supabaseAdmin
                        .from('user_dso_access')
                        .insert({
                            user_id: user_id,
                            dso_id: invite.dso_id,
                            role: invite.role,
                        });

                    if (accessError) {
                        console.error('Error adding user to DSO:', accessError);
                        continue;
                    }
                }

                // Mark the invite as accepted
                const { error: updateError } = await supabaseAdmin
                    .from('team_invites')
                    .update({
                        status: 'accepted',
                        accepted_at: new Date().toISOString(),
                    })
                    .eq('id', invite.id);

                if (updateError) {
                    console.error('Error updating invite status:', updateError);
                    continue;
                }

                acceptedCount++;

                // Get DSO name for the response
                const { data: dso } = await supabaseAdmin
                    .from('dsos')
                    .select('name')
                    .eq('id', invite.dso_id)
                    .single();

                if (dso) {
                    acceptedWorkspaces.push(dso.name);
                }
            } catch (error) {
                console.error('Error processing invite:', error);
            }
        }

        return NextResponse.json({
            success: true,
            message: acceptedCount > 0
                ? `Successfully joined ${acceptedCount} workspace(s)`
                : 'No new workspaces to join',
            accepted_count: acceptedCount,
            workspaces: acceptedWorkspaces,
        });
    } catch (error) {
        console.error('Error accepting invites:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
