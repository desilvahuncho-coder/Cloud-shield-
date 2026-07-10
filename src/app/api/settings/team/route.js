import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Manages organization team listings and role configurations
 */
export async function POST(request) {
  try {
    const { userId, action, targetUserEmail, targetUserId, newRole } = await request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
    }

    // 1. Verify requesting user profile and pull organization context + current rank
    const { data: requestingUser, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', userId)
      .single();

    if (profileErr || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Access denied: Profile validation failed.' }), { status: 403 });
    }

    const orgId = requestingUser.organization_id;
    const userRole = requestingUser.role; // e.g., 'admin', 'member'

    // 2. Action block: Fetch all active team members in the organization
    if (action === 'LIST') {
      const { data: members, error: fetchErr } = await supabaseAdmin
        .from('users')
        .select('id, email, role, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });

      if (fetchErr) throw fetchErr;
      return new Response(JSON.stringify({ members }), { status: 200 });
    }

    // 3. Authorization Boundary Check: Restrict mutative actions to Admins only
    if (userRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized: Only workspace Admins can modify team structures.' }), { status: 403 });
    }

    // 4. Action block: Update an existing member's access level
    if (action === 'UPDATE_ROLE') {
      if (!targetUserId || !newRole) {
        return new Response(JSON.stringify({ error: 'Missing parameters for role modification.' }), { status: 400 });
      }

      const { data: updatedUser, error: updateErr } = await supabaseAdmin
        .from('users')
        .update({ role: newRole })
        .eq('id', targetUserId)
        .eq('organization_id', orgId) // Secure scope isolation
        .select('id, email, role')
        .single();

      if (updateErr) throw updateErr;
      return new Response(JSON.stringify({ success: true, user: updatedUser }), { status: 200 });
    }

    // 5. Action block: Remove a member from the workspace team
    if (action === 'REMOVE_MEMBER') {
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: 'Target user identification missing.' }), { status: 400 });
      }

      // Prevent self-deletion loops for safety
      if (targetUserId === userId) {
        return new Response(JSON.stringify({ error: 'Aborted: You cannot evict yourself from your own workspace.' }), { status: 400 });
      }

      const { error: deleteErr } = await supabaseAdmin
        .from('users')
        .update({ organization_id: null, role: 'viewer' }) // Reset to unlinked state
        .eq('id', targetUserId)
        .eq('organization_id', orgId);

      if (deleteErr) throw deleteErr;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Invalid operation requested.' }), { status: 400 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
