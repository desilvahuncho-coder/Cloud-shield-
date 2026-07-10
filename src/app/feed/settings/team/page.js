'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import Link from 'next/link';

export default function TeamSettingsPage() {
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchTeamRoster = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Extract current client user details
      setCurrentUser(session.user);

      const response = await fetch('/api/settings/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, action: 'LIST' })
      });

      if (!response.ok) throw new Error('Could not pull your workspace team directory.');
      const data = await response.json();
      setMembers(data.members || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamRoster();
  }, []);

  const handleRoleChange = async (targetUserId, newRole) => {
    setProcessingId(targetUserId);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/settings/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          action: 'UPDATE_ROLE',
          targetUserId,
          newRole
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to modify permission level.');

      setSuccess('Permission status updated successfully.');
      setMembers(prev => prev.map(m => m.id === targetUserId ? { ...m, role: newRole } : m));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!confirm('Are you certain you wish to disconnect this member from your workspace?')) return;
    setProcessingId(targetUserId);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/settings/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          action: 'REMOVE_MEMBER',
          targetUserId
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to evict team member.');

      setSuccess('Member removed from workspace.');
      setMembers(prev => prev.filter(m => m.id !== targetUserId));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-500 p-12 max-w-5xl mx-auto">
        <p className="text-sm">Mapping team permissions directory...</p>
      </div>
    );
  }

  // Determine if current user is allowed to adjust configurations locally
  const currentProfile = members.find(m => m.id === currentUser?.id);
  const isAdmin = currentProfile?.role === 'admin';

  return (
    <div className="min-h-screen bg-white text-slate-900 pt-16 pb-12 px-8 max-w-4xl mx-auto">
      
      <div className="mb-8">
        <Link href="/feed" className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          ← Back to primary feed stream
        </Link>
      </div>

      <div className="border-b border-slate-100 pb-8">
        <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
        <p className="text-sm text-slate-500 mt-2">
          Review who has access to your organization workspace. **Admins** can change settings and pause servers, while **Viewers** can read metrics but cannot run optimization adjustments[span_5](start_span)[span_5](end_span).
        </p>
      </div>

      <div className="mt-10 space-y-6">
        {error && <div className="p-3 bg-red-50 text-red-600 rounded text-sm max-w-xl">{error}</div>}
        {success && <div className="p-3 bg-green-50 text-green-700 rounded text-sm font-medium max-w-xl">{success}</div>}

        <div className="bg-white border border-slate-100 rounded-md shadow-sm divide-y divide-slate-100">
          {members.map((member) => (
            <div key={member.id} className="p-4 flex items-center justify-between text-sm">
              <div>
                <span className="block font-semibold text-slate-900">
                  {member.email} {member.id === currentUser?.id && <span className="text-xs text-slate-400 font-normal ml-1">(You)</span>}
                </span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  Joined Workspace: {new Date(member.created_at).toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex items-center space-x-6">
                {/* Permission Control Selector Element */}
                <select
                  value={member.role}
                  disabled={!isAdmin || processingId === member.id || member.id === currentUser?.id}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="admin">Workspace Admin</option>
                  <option value="viewer">Workspace Viewer</option>
                </select>

                {/* Evoke Action Element */}
                {isAdmin && member.id !== currentUser?.id && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={processingId === member.id}
                    className="text-xs font-bold text-red-600 hover:underline disabled:text-slate-300"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
