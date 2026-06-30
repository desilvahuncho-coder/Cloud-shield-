// app/api/actions/resolve/route.js
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { EC2Client, StopInstancesCommand } from "@aws-sdk/client-ec2";
import { getAssumedCredentials } from "../../utils/aws-client";

/**
 * POST /api/actions/resolve
 * Executes structural remediation (Stopping idle compute) under explicit user seat attribution.
 */
export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });

  // 1. Enforce Authenticated Session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication credentials missing" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // 2. Ingest and validate runtime parameters
    const body = await request.json();
    const { problemId, resourceId, estimatedSavings } = body;

    if (!problemId || !resourceId || !estimatedSavings) {
      return NextResponse.json({ error: "Missing required execution targets" }, { status: 400 });
    }

    // 3. Re-verify organization profile boundaries
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: "Cross-tenant identity verification failed" }, { status: 403 });
    }

    const orgId = userProfile.organization_id;

    // 4. Fetch structural IAM target profiles assigned to organization container
    const { data: awsConnection, error: connError } = await supabase
      .from("aws_connections")
      .select("iam_role_arn, external_id")
      .eq("organization_id", orgId)
      .single();

    if (connError || !awsConnection) {
      return NextResponse.json({ error: "AWS connection config unavailable" }, { status: 404 });
    }

    // 5. Connect securely via AssumeRole token isolation exchange
    const temporaryCredentials = await getAssumedCredentials(
      awsConnection.iam_role_arn,
      awsConnection.external_id
    );

    // 6. Action Execution Gate: Initialize EC2 Execution Client using temporary access window
    const ec2Client = new EC2Client({
      region: "us-east-1",
      credentials: temporaryCredentials,
    });

    // Fire the granular action command: Only allowed to stop specific target instance IDs
    const stopCommand = new StopInstancesCommand({
      InstanceIds: [resourceId],
      Force: false, 
    });

    await ec2Client.send(stopCommand);

    // 7. Security Audit Logging: Log mutation entry attributing exactly WHO did WHAT and WHEN
    const { error: logError } = await supabase
      .from("audit_logs")
      .insert({
        organization_id: orgId,
        user_id: userId, // Individual seat tracking validation stamp
        resource_id: resourceId,
        action_taken: "ec2:StopInstances",
        estimated_savings: parseFloat(estimatedSavings)
      });

    if (logError) {
      // Log failure internally but do not stall response to client since AWS action was processed
      console.error("SECURITY CRITICAL: Failed to append audit trace record:", logError);
    }

    return NextResponse.json({ success: true, terminatedResourceId: resourceId });

  } catch (error) {
    console.error("CRITICAL ACTION EXECUTOR FAULT:", error);
    return NextResponse.json({ error: "AWS Resource manipulation failed or was restricted" }, { status: 500 });
  }
}
