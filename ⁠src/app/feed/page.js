'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export default function FeedPage() {
  const [metrics, setMetrics] = useState({ currentCost: '0.00', forecastCost: '0.00', totalSaved: '0.00' });
  const [problems, setProblems] = useState([]);
  const [recentlyPaused, setRecentlyPaused] = useState([]);
  const [extraCount, setExtraCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [undoingId, setUndoingId] = useState(null);

  const translateService = (rawService) => {
    if (!rawService) return 'cloud systems';
    const lowText = rawService.toLowerCase();
    if (lowText.includes('compute cloud') || lowText.includes('ec2')) return 'virtual cloud servers';
    if (lowText.includes('simple storage') || lowText.includes('s3')) return 'digital file storage';
    return 'background cloud systems';
  };

  const compileFeedData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const payload = { userId: session.user.id };

      const [metricsRes, idleRes, spikeRes, pausedRes] = await Promise.all([
        fetch('/api/feed/top-line', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
        fetch('/api/feed/idle-detection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
        fetch('/api/feed/bill-spike', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
        fetch('/api/feed/recently-paused', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      ]);

      if (!metricsRes.ok || !idleRes.ok || !spikeRes.ok || !pausedRes.ok) {
        throw new Error('Failed to synchronize cloud feed channels.');
      }

      const metricsData = await metricsRes.json();
      const idleData = await idleRes.json();
      const spikeData = await spikeRes.json();
      const pausedData = await pausedRes.json();

      setMetrics(metricsData);
      setRecentlyPaused(pausedData.recentlyPaused || []);

      // Combine and filter out items that are currently showing in the recently paused bucket
      const activePausedIds = new Set(pausedData.recentlyPaused.map(p => p.resource_id));
      const combinedProblems = [
        ...(idleData.problems || []),
        ...(spikeData.problems || [])
      ].filter(p => !activePausedIds.has(p.resource_id));

      const sortedProblems = combinedProblems.sort((a, b) => {
        if (a.riskLevel === 'high' && b.riskLevel !== 'high') return -1;
        if (a.riskLevel !== 'high' && b.riskLevel === 'high') return 1;
        return parseFloat(b.estimatedSavings || b.dollarDifference || 0) - parseFloat(a.estimatedSavings || a.dollarDifference || 0);
      });

      if (sortedProblems.length > 4) {
        setProblems(sortedProblems.slice(0, 4));
        setExtraCount(sortedProblems.length - 4);
      } else {
        setProblems(sortedProblems);
        setExtraCount(0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    compileFeedData();
  }, []);

  const handleUndo = async (log) => {
    setUndoingId(log.id);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/feed/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          resourceId: log.resource_id,
          estimatedSavings: log.estimated_savings
        })
      });

      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || 'Failed to restart resource.');
      }

      // Refresh the feed layout to update the top-line totals and remove the item from the list[span_8](start_span)[span_8](end_span)
      await compileFeedData();
    } catch (err) {
      setError(err.message);
    } {
      setUndoingId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-white text-slate-500 p-12 max-w-5xl mx-auto">Assembling cloud profiles...</div>;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 pt-16 pb-12 px-8 max-w-5xl mx-auto">
      {error && <div className="mb-8 p-3 bg-red-50 text-red-600 rounded text-sm max-w-md">{error}</div>}

      {/* Top Line Panels */}
      <div className="grid grid-cols-3 gap-12 border-b border-slate-100 pb-12">
        <div>
          <span className="block text-xs font-semibold tracking-wider text-slate-400 uppercase">Cost so far this month</span>
          <span className="block text-5xl font-bold tracking-tight text-slate-900 mt-2">${metrics.currentCost}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold tracking-wider text-slate-400 uppercase">Expected total by month-end</span>
          <span className="block text-5xl font-bold tracking-tight text-slate-900 mt-2">${metrics.forecastCost}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold tracking-wider text-slate-400 uppercase">Total saved this month</span>
          <span className="block text-5xl font-bold tracking-tight text-green-600 mt-2">${metrics.totalSaved}</span>
        </div>
      </div>

      {/* Main Problem Feed Queue */}
      <div className="mt-12 space-y-12">
        <div className="divide-y divide-slate-100">
          {problems.map((problem) => (
            <div key={problem.id} className="py-6 flex items-center justify-between group first:pt-0 last:pb-0">
              <div className="flex items-start space-x-4 max-w-3xl">
                <div className="mt-1 flex-shrink-0">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${problem.riskLevel === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                </div>
                <div>
                  <Link href={`/feed/explore/${problem.id}?type=${problem.type}&res=${problem.resourceId || ''}`} className="block text-base font-semibold text-slate-900 hover:underline">
                    {problem.type === 'idle_instance' ? `A server called '${problem.resourceName}' has been left running completely unused` : `Your daily bill spiked unexpectedly today`}
                  </Link>
                  <p className="text-sm text-slate-500 mt-1">
                    {problem.type === 'idle_instance' ? `This asset has generated zero active workload engagement metrics for the past 3 consecutive days.` : `Charges from your ${translateService(problem.drivingService)} increased by $${problem.dollarDifference}.`}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 ml-6">
                <span className="inline-block px-3 py-1 bg-green-50 text-green-700 font-semibold text-sm rounded-full">
                  Save ${problem.type === 'idle_instance' ? problem.estimatedSavings : problem.dollarDifference}/mo
                </span>
              </div>
            </div>
          ))}
        </div>

        {extraCount > 0 && (
          <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">+ {extraCount} more optimization items waiting down inside the queue</p>
        )}

        {/* Recently Paused List Section[span_9](start_span)[span_9](end_span) */}
        {recentlyPaused.length > 0 && (
          <div className="pt-8 border-t border-slate-100">
            <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-4">Recently Paused (Last 24 Hours)</h2>
            <div className="space-y-3">
              {recentlyPaused.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-100">
                  <span>The virtual server <strong className="text-slate-800">#{log.resource_id}</strong> was paused.</span>
                  <button
                    onClick={() => handleUndo(log)}
                    disabled={undoingId === log.id}
                    className="text-slate-900 font-semibold hover:underline disabled:text-slate-400"
                  >
                    {undoingId === log.id ? 'Turning back on...' : 'Turn it back on'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
