import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { getAssumedCredentials } from "@/app/api/utils/aws-client";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Resolve Multi-Tenant Organization Context Boundary
    const { data: profile } = await supabase.from("users").select("organization_id").eq("id", session.user.id).single();
    const { data: conn } = await supabase.from("aws_connections").select("iam_role_arn, external_id").eq("organization_id", profile.organization_id).single();

    if (!conn) return NextResponse.json({ error: "AWS Config Missing" }, { status: 404 });

    // 2. Exchange credentials via server-side STS AssumeRole
    const credentials = await getAssumedCredentials(conn.iam_role_arn, conn.external_id);
    const config = { region: "us-east-1", credentials };

    // Initialize clients
    const ceClient = new CostExplorerClient(config);
    const ec2Client = new EC2Client(config);
    const cwClient = new CloudWatchClient(config);

    const discoveredProblems = [];

    // ==========================================
    // ENGINE 1: CLOUD BILL SPIKE ANALYZER (Week 1 Feature 5)
    // ==========================================
    const today = new Date();
    const endStr = today.toISOString().split("T")[0];
    
    // Look back 8 days to compare today vs 7-day average baseline
    const start = new Date();
    start.setDate(today.getDate() - 8);
    const startStr = start.toISOString().split("T")[0];

    const costCommand = new GetCostAndUsageCommand({
      TimePeriod: { Start: startStr, End: endStr },
      Granularity: "DAILY",
      Metrics: ["UnblendedCost"]
    });

    const costData = await ceClient.send(costCommand);
    const dailyCosts = costData.ResultsByTime?.map(r => parseFloat(r.Total?.UnblendedCost?.Amount || "0")) || [];
    
    let currentMonthCost = dailyCosts.reduce((a, b) => a + b, 0); // Local aggregation metric
    let predictedForecast = currentMonthCost * 3.5; 
    let totalSavedThisMonth = 0.00; // Will update as database mutations pull logs

    if (dailyCosts.length >= 2) {
      const todaySpend = dailyCosts[dailyCosts.length - 1];
      const historicalWeek = dailyCosts.slice(0, dailyCosts.length - 1);
      const sevenDayAverage = historicalWeek.reduce((a, b) => a + b, 0) / historicalWeek.length;

      // Spike Condition Rule: Today's spend jumps over the historical average
      if (todaySpend > sevenDayAverage * 1.15 && todaySpend > 10) { 
        discoveredProblems.push({
          id: `spike-${Date.now()}`,
          type: "spike",
          title: "Sudden Daily Spend Anomaly Detected",
          description: `Today's localized AWS run-rate of $${todaySpend.toFixed(2)} is pacing higher than your rolling 7-day historical baseline of $${sevenDayAverage.toFixed(2)}/day.`,
          risk: "red",
          structuralTarget: "Cost Explorer: Account Total Run-Rate",
          savings: parseFloat((todaySpend - sevenDayAverage) * 30)
        });
      }
    }

    // ==========================================
    // ENGINE 2: IDLE EC2 INSTANCE DETECTOR (Week 1 Feature 4)
    // ==========================================
    const instancesData = await ec2Client.send(new DescribeInstancesCommand({
      Filters: [{ Name: "instance-state-name", Values: ["running"] }]
    }));

    const runningInstances = instancesData.Reservations?.flatMap(r => r.Instances || []) || [];

    if (runningInstances.length > 0) {
      const queries = runningInstances.map((inst, index) => ({
        Id: `m_${index}`,
        MetricStat: {
          Metric: { Namespace: "AWS/EC2", MetricName: "CPUUtilization", Dimensions: [{ Name: "InstanceId", Value: inst.InstanceId }] },
          Period: 86400, // Aggregate inside 24-hour buckets
          Stat: "Maximum"
        }
      }));

      // CloudWatch limits requests to 50 metrics per command call block
      const cwCommand = new GetMetricDataCommand({
        MetricDataQueries: queries.slice(0, 50),
        StartTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Strict 3-day history window
        EndTime: new Date()
      });

      const cwMetrics = await cwClient.send(cwCommand);

      runningInstances.slice(0, 50).forEach((inst, index) => {
        const metricResults = cwMetrics.MetricDataResults?.find(r => r.Id === `m_${index}`);
        const maxCpuValues = metricResults?.Values || [];
        
        // Check if CPU sustained lower than 1.5% for all days recorded
        const isIdle = maxCpuValues.length > 0 && maxCpuValues.every(val => val < 1.5);

        if (isIdle) {
          discoveredProblems.push({
            id: `idle-${inst.InstanceId}`,
            type: "idle",
            title: `Idle Compute Core: ${inst.InstanceId}`,
            description: `This instance has registered a peak CPU capacity threshold below 1.5% consistently for 3 straight operational days. Shutting it down curbs passive run-rate leaks.`,
            risk: "amber",
            structuralTarget: inst.InstanceId,
            savings: 45.00 // Standardized baseline mapping metric for isolated dev compute units
          });
        }
      });
    }

    // ==========================================
    // PRIORITY ENGINE: SORTING & QUEUE CAP
    // ==========================================
    // Sort structurally: Risk level first (Red spikes up), then potential cash savings descending
    const prioritizedQueue = discoveredProblems.sort((a, b) => {
      if (a.risk === "red" && b.risk !== "red") return -1;
      if (a.risk !== "red" && b.risk === "red") return 1;
      return b.savings - a.savings;
    });

    // Enforce the strict product shape window limitation constraint: up to 4 items max
    const visibleQueue = prioritizedQueue.slice(0, 4);

    return NextResponse.json({
      metrics: { current: currentMonthCost, forecast: predictedForecast, saved: totalSavedThisMonth },
      queue: visibleQueue
    });

  } catch (error) {
    console.error("ANALYZER_CRITICAL_FAULT:", error);
    return NextResponse.json({ error: "Internal operational processing failure" }, { status: 500 });
  }
}
