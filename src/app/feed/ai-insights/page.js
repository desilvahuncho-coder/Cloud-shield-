'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';

export default function AIInsightsPage() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Simulated target selector tracking a major cost surge event log
  const activeAnomalyId = 'anomaly-log-90812';

  useEffect(() => {
    const fetchAIGeneratedSummary = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch('/api/feed/ai-explainer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.user.id, anomalyId: activeAnomalyId })
        });

        if (!response.ok) throw new Error('Could not fetch an AI plain-English summary breakdown.');
        const data = await response.json();
        setInsights(data.insights);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAIGeneratedSummary();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-500 p-12 max-w-3xl mx-auto">
        <p className="text-sm animate-pulse font-medium">Running deep log diagnostic scans and formatting plain-English summary...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 pt-16 pb-12 px-8 max-w-3xl mx-auto">
      
      <div className="mb-8">
        <Link href="/feed" className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          ← Back to primary feed stream
        </Link>
      </div>

      {error && <div className="mb-6 p-3 bg-red-50 text-red-600 rounded text-sm max-w-xl">{error}</div>}

      {insights && (
        <div className="space-y-8">
          
          {/* Section Header elements layout */}
          <div className="border-b border-slate-100 pb-6">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 mb-3">
              CloudShield Intelligence
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Plain-English Diagnostics</h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Automated intelligence scans parsing complicated server resource trajectories into clear, plain narrative terms[span_3](start_span)[span_3](end_span).
            </p>
          </div>

          {/* AI Content Grid presentation block */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 max-w-2xl">
            
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">What Happened</h3>
              <p className="text-sm text-slate-800 leading-relaxed font-normal">{insights.summary}</p>
            </div>

            <div className="space-y-1.5 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Financial Waste Velocity</h3>
              <p className="text-sm font-semibold text-red-600">{insights.impact}</p>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Mitigations</h3>
              <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed space-y-2 font-normal">
                {insights.recommendation}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
