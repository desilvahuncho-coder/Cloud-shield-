// app/api/actions/resolve/route.js
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { EC2Client, StopInstancesCommand } from "@aws-sdk/client-ec2";
import { getAssumedCredentials } from "../../utils/aws-client";

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });

  // 1. Verify User Session Tracking individual seat identity
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { problemId, resourceId, estimatedSavings } = await request.json();
    if (!resourceId) {
      return NextResponse.json({ error: "Missing Target Resource ID" }, { status: 400 });
    }

    // 2. Resolve Multi-Tenant Organization Isolation Profile
    const { data: profile } = await supabase.from("users").select("organization_id").eq("id", session.user.id).single();
    const { data: conn } = await supabase.from("aws_connections").select("iam_role_arn, external_id").eq("organization_id", profile.organization_id).single();

    if (!conn) return NextResponse.json({ error: "AWS Integration Not Found" }, { status: 404 });

    // 3. Assume Cross-Account IAM Role
    const credentials = await getAssumedCredentials(conn.iam_role_arn, conn.external_id);
    
    // 4. Fire Non-Negotiable Week 1 Destruction Payload (STOP ONLY)
    const ec2Client = new EC2Client({ region: "us-east-1", credentials });
    const stopCommand = new StopInstancesCommand({
      InstanceIds: [resourceId],
      Force: false // Graceful shutdown protocol configuration
    });

    await ec2Client.send(stopCommand);

    // 5. Append Audit Log with Precise Seat Attribution
    await supabase.from("audit_logs").insert({
      organization_id: profile.organization_id,
      user_id: session.user.id, // Tracks exactly which of the 3 seats triggered the execution
      resource_id: resourceId,
      action_taken: "ec2:StopInstances",
      estimated_savings: estimatedSavings || 45.00
    });

    return NextResponse.json({ success: true, resolvedTarget: resourceId });

  } catch (error) {
    console.error("DESTRUCTION_PIPELINE_FAULT:", error);
    return NextResponse.json({ error: "AWS API Execution Refused or Database Logging Failed" }, { status: 500 });
  }
}
