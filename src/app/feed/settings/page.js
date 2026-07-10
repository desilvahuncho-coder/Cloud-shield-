'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';

export default function SettingsPage() {
  const [exclusions, setExclusions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const fetchExclusionRules = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/settings/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, action: 'LIST' })
      });

      if (!response.ok) throw new Error('Could not pull your resource exclusions configurations.');
      const data = await response.json();
      setExclusions(data.exclusions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExclusionRules();
  }, []);

  const handleUnmute = async (resourceId) => {
    setProcessingId(resourceId);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/settings/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          action: 'REMOVE',
          resourceId
        })
      });

      if (!response.ok) throw new Error('Failed to unmute this infrastructure asset.');
      
      // Instantly cascade array update locally across UI layout
      setExclusions(prev => prev.filter(item => item.resource_id !== resourceId));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-500 p-12 max-w-5xl mx-auto">
        <p className="text-sm">Pulling asset policy exclusions state...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 pt-16 pb-12 px-8 max-w-5xl mx-auto">
      
      {/* Navigation back arrow header row */}
      <div className="mb-8">
        <Link href="/feed" className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          ← Back to primary feed stream
        </Link>
      </div>

      {error && <div className="mb-8 p-3 bg-red-50 text-red-600 rounded text-sm max-w-md">{error}</div>}

      {/* Structural overview descriptions */}
      <div className="border-b border-slate-100 pb-8">
        <h1 className="text-3xl font-bold tracking-tight">System Settings & Policies</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Configure rule baseline overrides here. Adding an asset to this exclusion dashboard tells CloudShield to ignore its low activity metrics entirely, hiding it from daily spend analysis flags.
        </p>
      </div>

      {/* Exclusions Content Layout block */}
      <div className="mt-10">
        <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-4">Ignored Systems List</h2>
        
        {exclusions.length === 0 ? (
          <div className="text-center text-slate-400 py-12 border border-dashed border-slate-200 rounded-md">
            <p className="text-sm">You aren't ignoring any cloud resources right now. All active systems are currently being scanned.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-md divide-y divide-slate-100 shadow-sm max-w-3xl">
            {exclusions.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <span className="block font-semibold text-slate-900">{item.resource_name}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">Asset System ID: #{item.resource_id}</span>
                </div>
                <div>
                  <button
                    onClick={() => handleUnmute(item.resource_id)}
                    disabled={processingId === item.resource_id}
                    className="text-xs font-bold text-red-600 hover:underline disabled:text-slate-400"
                  >
                    {processingId === item.resource_id ? 'Unmuting rules...' : 'Resume Monitoring'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
