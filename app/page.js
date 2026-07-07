"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProblemFeedPage() {
  const router = useRouter();
  
  // Interface states
  const [metrics, setMetrics] = useState({ current: 0, forecast: 0, saved: 0 });
  const [queue, setQueue] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 1. Fetch live metrics and prioritized problem queue on component mount
  useEffect(() => {
    async function fetchFeedData() {
      try {
        const response = await fetch("/app/api/feed");
        if (!response.ok) throw new Error("Could not load your feed details.");
        const data = await response.json();
        
        setMetrics(data.metrics || { current: 0, forecast: 0, saved: 0 });
        setQueue(data.queue || []);
      } catch (err) {
        setErrorMessage("Something went wrong while retrieving cloud alerts. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchFeedData();
  }, []);

  // 2. Handle the explicit confirmation click and attribute the action to the user seat
  async function handleConfirmAction() {
    if (!selectedProblem) return;
    
    setActioning(true);
    setErrorMessage("");

    try {
      const response = await fetch("/app/api/actions/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: selectedProblem.structuralTarget,
          estimatedSavings: selectedProblem.savings,
          type: selectedProblem.type
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The server could not process this action.");
      }

      // Successful mutation: Update state tracking immediately locally to maintain single loop
      const updatedQueue = queue.filter(item => item.id !== selectedProblem.id);
      setQueue(updatedQueue);
      
      // Update the top-line numbers dynamically to show updated savings
      setMetrics(prev => ({
        ...prev,
        saved: prev.saved + selectedProblem.savings
      }));

      // Close the view window and slide the next item forward
      setSelectedProblem(null);

    } catch (err) {
      setErrorMessage(err.message || "An unexpected error occurred during execution.");
    } finally {
      setActioning(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center font-sans">
        <p className="text-lg tracking-wide">Loading cloud data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased px-6 py-16 max-w-4xl mx-auto">
      
      {/* ERROR ANCHOR */}
      {errorMessage && (
        <div className="mb-8 p-4 bg-red-50 text-red-700 border border-red-100 rounded text-sm">
          {errorMessage}
        </div>
      )}

      {/* TOP OF SCREEN: THREE NUMBERS ONLY */}
      <section className="grid grid-cols-3 gap-12 mb-24 border-b border-gray-100 pb-12">
        <div>
          <p className="text-xs tracking-wider text-gray-400 uppercase mb-2">This Month's Bill</p>
          <p className="text-4xl font-light text-gray-900">${metrics.current.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs tracking-wider text-gray-400 uppercase mb-2">Expected Month-End</p>
          <p className="text-4xl font-light text-gray-900">${metrics.forecast.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs tracking-wider text-gray-400 uppercase mb-2">Total Saved So Far</p>
          <p className="text-4xl font-light text-green-600">${metrics.saved.toFixed(2)}</p>
        </div>
      </section>

      {/* MAIN VIEWPORT SINGLE INTERLOCKING LOOP CONTAINER */}
      {!selectedProblem ? (
        <section>
          <h2 className="text-sm tracking-widest text-gray-400 uppercase mb-8">Current Action Items</h2>
          
          {queue.length === 0 ? (
            <p className="text-gray-500 py-12 text-center border border-dashed border-gray-100 rounded">
              Your system is completely optimized. No issues found.
            </p>
          ) : (
            <div className="space-y-6">
              {queue.map((problem) => (
                <div 
                  key={problem.id}
                  onClick={() => setSelectedProblem(problem)}
                  className="group flex items-center justify-between py-6 px-4 -mx-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                >
                  <div className="flex items-center space-x-6 pr-6">
                    {/* Color Coding Indicator Dot */}
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      problem.risk === "red" ? "bg-red-500" : "bg-amber-400"
                    }`} />
                    <div>
                      {/* Jargon-free presentation string logic rendering */}
                      <p className="text-base text-gray-900 font-normal leading-snug">{problem.title}</p>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-1">{problem.description}</p>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <p className="text-base text-green-600 font-medium">+${problem.savings.toFixed(2)}</p>
                    <p className="text-xs text-gray-400 mt-1">saved/mo</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* SINGLE EXPLANATION SCREEN */
        <section className="animate-fadeIn">
          {/* Back button link */}
          <button 
            onClick={() => setSelectedProblem(null)}
            className="text-xs tracking-wider text-gray-400 uppercase mb-12 hover:text-gray-900 transition-colors"
          >
            ← Back to action items
          </button>

          <div className="max-w-2xl">
            {/* Risk Indicator Tag */}
            <span className={`inline-block px-2.5 py-1 text-xs tracking-wider uppercase font-medium rounded mb-6 ${
              selectedProblem.risk === "red" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
            }`}>
              {selectedProblem.risk === "red" ? "Immediate Action Advised" : "Optimization Opportunity"}
            </span>

            <h1 className="text-3xl font-light tracking-tight text-gray-900 mb-6">
              {selectedProblem.title}
            </h1>

            <div className="space-y-8 text-base text-gray-600 leading-relaxed font-light mb-12">
              <div>
                <h3 className="text-xs tracking-wider text-gray-400 uppercase font-medium mb-2">What is happening?</h3>
                <p>{selectedProblem.description}</p>
              </div>

              <div>
                <h3 className="text-xs tracking-wider text-gray-400 uppercase font-medium mb-2">What will happen when you confirm?</h3>
                <p>
                  {selectedProblem.type === "idle" 
                    ? "We will issue a safe temporary sleep command directly to this cloud server. It will securely turn off immediately, stopping the operational cash drain without altering or erasing any of its data storage configuration contexts."
                    : "This abnormal billing notice parameter threshold will be cleared from your central feed alerts stream database tracking queue and recalibrated for continuous trend monitoring downstream."}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-xs tracking-wider text-gray-400 uppercase font-medium mb-1">Estimated Direct Financial Gain</h3>
                <p className="text-3xl font-light text-green-600">+${selectedProblem.savings.toFixed(2)} <span className="text-sm text-gray-400 font-normal">per single standard operational cycle month</span></p>
              </div>
            </div>

            {/* ONE CONFIRM BUTTON LOOP */}
            <button
              onClick={handleConfirmAction}
              disabled={actioning}
              className={`w-full md:w-auto px-8 py-4 text-sm font-medium tracking-wide text-white rounded transition-colors duration-150 ${
                selectedProblem.risk === "red" 
                  ? "bg-red-600 hover:bg-red-700 disabled:bg-red-400" 
                  : "bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400"
              }`}
            >
              {actioning ? "Processing execution changes..." : "Confirm and Fix This Instantly"}
            </button>
          </div>
        </section>
      )}

    </div>
  );
}
