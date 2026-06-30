// app/dashboard/page.js
"use client";
import { useState, useEffect } from "react";

export default function ProblemFeedPage() {
  const [metrics, setMetrics] = useState({ current: 0, forecast: 0, saved: 0 });
  const [problems, setProblems] = useState([]);
  const [activeProblem, setActiveProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  // Ingest live telemetry directly from our server-side API feed route
  useEffect(() => {
    async function fetchFeedData() {
      try {
        const response = await fetch("/api/feed");
        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics);
          setProblems(data.queue);
        }
      } catch (err) {
        console.error("Failed to sync live operational telemetry:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchFeedData();
  }, []);

  // Fire execution request to the server-side action script
  const handleConfirmAction = async () => {
    if (!activeProblem || executing) return;
    setExecuting(true);
    
    try {
      const response = await fetch("/api/actions/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: activeProblem.id,
          resourceId: activeProblem.structuralTarget,
          estimatedSavings: activeProblem.savings
        })
      });

      if (response.ok) {
        // Optimistically drop the fixed item from the queue list
        setProblems(problems.filter(p => p.id !== activeProblem.id));
        setActiveProblem(null);
      } else {
        alert("Action rejected by backend verification rules.");
      }
    } catch (err) {
      console.error("Execution pipeline error:", err);
    } finally {
      setExecuting(false);
    }
  };

  if (loading) return <div className="p-24 text-sm font-sans tracking-tight text-slate-400">Syncing secure feed metrics...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans tracking-tight text-slate-900 antialiased">
      <main className="mx-auto max-w-4xl px-6 py-20">
        
        {/* Top Section: Three Numbers Only */}
        <section className="grid grid-cols-3 gap-12 pb-16 border-b border-slate-200/60">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Current Month Cost</p>
            <p className="mt-2 text-4xl font-light tracking-tight text-slate-900">${metrics.current.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Month-End Forecast</p>
            <p className="mt-2 text-4xl font-light tracking-tight text-slate-900">${metrics.forecast.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Saved This Month</p>
            <p className="mt-2 text-4xl font-medium tracking-tight text-emerald-600">${metrics.saved.toLocaleString()}</p>
          </div>
        </section>

        {/* Bottom Section: Priority Queue Loop */}
        <section className="pt-16">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-8">Priority Attention Queue</h2>
          
          {problems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
              Infrastructure operating within nominal spending boundaries. Clear feed.
            </div>
          ) : (
            <div className="space-y-4">
              {problems.map((problem) => (
                <div 
                  key={problem.id}
                  onClick={() => setActiveProblem(problem)}
                  className="group flex items-center justify-between rounded-xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${problem.risk === "red" ? "bg-rose-500 animate-pulse" : "bg-amber-400"}`} />
                    <div>
                      <h3 className="font-medium text-slate-800 text-base group-hover:text-slate-900">{problem.title}</h3>
                      <p className="text-sm text-slate-400 mt-0.5 line-clamp-1 max-w-xl">{problem.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-emerald-600">+${problem.savings.toFixed(2)}/mo</span>
                    <span className="block text-[11px] font-medium text-slate-400 uppercase mt-0.5 tracking-wider">View Risk</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Single Context Explanation Screen Modal */}
        {activeProblem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl border border-slate-100">
              <div className="flex justify-between items-start">
                <span className={`text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-md ${activeProblem.risk === "red" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>
                  {activeProblem.risk === "red" ? "Immediate Threat Matrix" : "Optimization Opportunity"}
                </span>
                <button onClick={() => setActiveProblem(null)} className="text-slate-300 hover:text-slate-500 text-lg">✕</button>
              </div>

              <h3 className="text-xl font-semibold text-slate-900 mt-4 tracking-tight">{activeProblem.title}</h3>
              
              <div className="mt-6 space-y-4 text-sm text-slate-600">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Context Explanation</h4>
                  <p className="mt-1 leading-relaxed">{activeProblem.description}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Resource ID</h4>
                  <code className="mt-1 block font-mono text-xs bg-slate-50 border border-slate-100 p-2 rounded text-slate-700">{activeProblem.structuralTarget}</code>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Expected Resolution Behavior</h4>
                  <p className="mt-1 leading-relaxed">Target compute infrastructure state shifts offline instantly. Run-rate consumption drops immediately.</p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Calculated Return</span>
                  <span className="text-2xl font-semibold text-emerald-600">${activeProblem.savings.toFixed(2)} <span className="text-xs font-normal text-slate-400">/mo</span></span>
                </div>
                <button 
                  onClick={handleConfirmAction}
                  disabled={executing}
                  className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400 transition-all shadow-sm"
                >
                  {executing ? "Executing..." : "Confirm Resolution Action"}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
