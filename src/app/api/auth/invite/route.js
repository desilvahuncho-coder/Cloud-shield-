import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { invitedEmail, adminUserId } = await request.json();

    // 1. Identify the inviting user's organization and verify admin status
    const { data: adminUser, error: adminErr } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', adminUserId)
      .single();

    if (adminErr || !adminUser || adminUser.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized access level' }), { status: 403 });
    }

    const orgId = adminUser.organization_id;

    // 2. Enforce the strict 3-seat limit check before generating an invite
    const { count, error: countErr } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    if (countErr) throw countErr;

    if (count >= 3) {
      return new Response(
        JSON.stringify({ error: 'Your account has reached its maximum limit of 3 user seats.' }),
        { status: 400 }
      );
    }

    // 3. Invite the user via email using Supabase Auth Admin triggers
    const { data: authUser, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      invitedEmail
    );

    if (inviteErr) throw inviteErr;

    // 4. Record the new seat inside our local users table structure
    const { error: insertErr } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authUser.user.id,
          organization_id: orgId,
          email: invitedEmail,
          role: 'member'
        }
      ]);

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
