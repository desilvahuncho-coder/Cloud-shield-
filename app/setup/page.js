"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function AWSConnectionSetup() {
  const router = useRouter();
  const supabase = createClient();

  const [orgId, setOrgId] = useState("");
  const [roleArn, setRoleArn] = useState("");
  const [awsAccountId, setAwsAccountId] = useState("");
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", type: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWorkspaceInfo() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("role, organization_id")
        .eq("id", session.user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        router.push("/");
        return;
      }

      setOrgId(profile.organization_id);
      setLoading(false);
    }
    loadWorkspaceInfo();
  }, [supabase, router]);

  const externalId = orgId ? `CloudShield_${orgId.split("-")[0]}` : "GENERATING_KEY";

  async function handleConnect(e) {
    e.preventDefault();
    setTesting(true);
    setFeedback({ message: "", type: "" });

    try {
      const res = await fetch("/api/aws/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleArn, awsAccountId }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Handshake verification failed.");

      setFeedback({ 
        message: `Connected successfully! Verified workspace with active billing telemetry of $${data.detectedMonthlyCost.toFixed(2)} this month.`, 
        type: "success" 
      });

      setTimeout(() => {
        router.push("/");
      }, 2000);

    } catch (err) {
      setFeedback({ message: err.message, type: "error" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <div className="p-12 text-slate-400 text-sm font-light">Verifying administrative access...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8 max-w-3xl mx-auto py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Link your AWS Account</h1>
        <p className="text-sm text-slate-500 mt-2">
          This connection applies across your entire organization. All 3 team seats will view the feed linked to this role.
        </p>
      </div>

      {feedback.message && (
        <div className={`p-4 rounded mb-8 text-sm ${
          feedback.type === "error" ? "bg-red-50 border-l-4 border-red-500 text-red-700" : "bg-green-50 border-l-4 border-green-500 text-green-700"
        }`}>
          {feedback.message}
        </div>
      )}

      {/* STEP 1: DEFINE TARGET IAM POLICIES */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 mb-8 shadow-sm">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Required AWS Role Configurations</h2>
        <p className="text-xs text-slate-600 mb-6 leading-relaxed">
          Log into your AWS Console, navigate to IAM, create an assumed role for target AWS account <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-900">{process.env.NEXT_PUBLIC_AWS_CENTRAL_ACCOUNT_ID || "123456789012"}</code>, require External ID <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-900">{externalId}</code>, and attach these specific policies:
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">1. Diagnostics Read Policy</h3>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded text-[11px] font-mono overflow-x-auto leading-relaxed">
{`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetCostForecast",
        "ce:GetAnomalies",
        "ec2:DescribeInstances",
        "cloudwatch:GetMetricData"
      ],
      "Resource": "*"
    }
  ]
}`}
            </pre>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">2. Stopping Optimization Action Policy</h3>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded text-[11px] font-mono overflow-x-auto leading-relaxed">
{`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:StopInstances"
      ],
      "Resource": "*"
    }
  ]
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* CONNECTION FORM */}
      <form onSubmit={handleConnect} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">AWS Account ID</label>
          <input 
            type="text" 
            required 
            placeholder="123456789012"
            value={awsAccountId}
            onChange={(e) => setAwsAccountId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">IAM Role ARN</label>
          <input 
            type="text" 
            required 
            placeholder="arn:aws:iam::123456789012:role/CloudShieldAccess"
            value={roleArn}
            onChange={(e) => setRoleArn(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded shadow-sm text-sm font-mono focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-slate-900"
          />
        </div>

        <button 
          type="submit" 
          disabled={testing}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs tracking-wider uppercase rounded shadow-sm transition-colors disabled:bg-slate-400"
        >
          {testing ? "Testing Connection Telemetry..." : "Validate & Connect Workspace"}
        </button>
      </form>
    </div>
  );
}
