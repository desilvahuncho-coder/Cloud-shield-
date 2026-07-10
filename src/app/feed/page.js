'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export default function FeedPage() {
  const [metrics, setMetrics] = useState({ currentCost: '0.00', forecastCost: '0.00', totalSaved: '0.00' });
  const [problems, setProblems] = useState([]);
  const [extraCount, setExtraCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Plain-language translation map to completely scrub cloud provider terminology
  const translateService = (rawService) => {
    if (!rawService) return 'cloud systems';
    const lowText = rawService.toLowerCase();
    if (lowText.includes('compute cloud') || lowText.includes('ec2')) return 'virtual cloud servers';
    if (lowText.includes('simple storage') || lowText.includes('s3')) return 'digital file storage';
    if (lowText.includes('relational database') || lowText.includes('rds')) return 'database setups';
    return 'background cloud systems';
  };

  useEffect(() => {
    const compileFeedData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const payload = { userId: session.user.id };

        // 1. Fetch top-line numbers and both detection sets asynchronously
        const [metricsRes, idleRes, spikeRes] = await Promise.all([
          fetch('/api/feed/top-line', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
          fetch('/api/feed/idle-detection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
          fetch('/api/feed/bill-spike', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        ]);

        if (!metricsRes.ok || !idleRes.ok || !spikeRes.ok) {
          throw new Error('Failed to synchronize current cloud feed channels.');
        }

        const metricsData = await metricsRes.json();
        const idleData = await idleRes.json();
        const spikeData = await spikeRes.json();

        setMetrics(metricsData);

        // 2. Combine and unify all discovered infrastructure anomalies
        const combinedProblems = [...(idleData.problems || []), ...(spikeData.problems || [])];

        // 3. Strict sorting logic: Sort by high-risk first, then by estimated savings descending
        const sortedProblems = combinedProblems.sort((a, b) => {
          if (a.riskLevel === 'high' && b.riskLevel !== 'high') return -1;
          if (a.riskLevel !== 'high' && b.riskLevel === 'high') return 1;
          return parseFloat(b.estimatedSavings || b.dollarDifference || 0) - parseFloat(a.estimatedSavings || a.dollarDifference || 0);
        });

        // 4. Queue isolation: Render a maximum of 4 active items and store leftovers
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

    compileFeedData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-500 p-12 max-w-5xl mx-auto">
        <p className="text-sm">Assembling current spending profiles...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 pt-16 pb-12 px-8 max-w-5xl mx-auto">
      {error && (
        <div className="mb-8 p-3 bg-red-50 text-red-600 rounded text-sm max-w-md">
          {error}
        </div>
      )}

      {/* Top Line Metrics Summary Panel */}
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

      {/* Main Streamlined Problem Feed List */}
      <div className="mt-12">
        {problems.length === 0 ? (
          <div className="text-center text-slate-400 py-16 border border-dashed border-slate-200 rounded-md">
            <p className="text-sm">Great job! No wasteful activities or unexpected bill spikes detected across your infrastructure.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {problems.map((problem) => (
              <div key={problem.id} className="py-6 flex items-center justify-between group first:pt-0 last:pb-0">
                <div className="flex items-start space-x-4 max-w-3xl">
                  {/* Flat Color-Coded Risk Indicators */}
                  <div className="mt-1 flex-shrink-0">
                    {problem.riskLevel === 'high' ? (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" title="Urgent Action Required" />
                    ) : (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" title="Optimization Advisory" />
                    )}
                  </div>

                  {/* Clean Text Explanations without tech jargon */}
                  <div>
                    <Link href={`/feed/explore/${problem.id}?type=${problem.type}&res=${problem.resourceId || ''}`} className="block text-base font-semibold text-slate-900 hover:underline">
                      {problem.type === 'idle_instance' 
                        ? `A server called '${problem.resourceName}' has been left running completely unused`
                        : `Your daily bill spiked unexpectedly today`}
                    </Link>
                    <p className="text-sm text-slate-500 mt-1">
                      {problem.type === 'idle_instance'
                        ? `This asset has generated zero active processing engagement metrics for the past 3 consecutive days.`
                        : `Charges originating from your ${translateService(problem.drivingService)} increased by $${problem.dollarDifference} past standard parameters.`}
                    </p>
                  </div>
                </div>

                {/* Right Aligned Action Badge */}
                <div className="flex-shrink-0 ml-6 text-right">
                  <span className="inline-block px-3 py-1 bg-green-50 text-green-700 font-semibold text-sm rounded-full">
                    Save ${problem.type === 'idle_instance' ? problem.estimatedSavings : problem.dollarDifference}/mo
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Capped Feed Remaining Overflow Tracker */}
        {extraCount > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              + {extraCount} more optimization problems items waiting down inside the queue
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
