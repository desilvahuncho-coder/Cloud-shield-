import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";

/**
 * Negotiates dynamic, temporary credentials for a tenant using STS AssumeRole.
 */
export async function getTenantAwsCredentials(roleArn, externalId) {
  const stsClient = new STSClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_CENTRAL_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_CENTRAL_SECRET_ACCESS_KEY,
    },
  });

  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: `CloudShieldSession_${Date.now()}`,
    ExternalId: externalId,
    DurationSeconds: 900, // Minimal duration: 15 minutes
  });

  const response = await stsClient.send(command);
  
  return {
    accessKeyId: response.Credentials.AccessKeyId,
    secretAccessKey: response.Credentials.SecretAccessKey,
    sessionToken: response.Credentials.SessionToken,
  };
}

/**
 * Validates the connection to AWS by requesting the current month's cost telemetry
 */
export async function testAwsConnection(roleArn, externalId) {
  const tempCredentials = await getTenantAwsCredentials(roleArn, externalId);

  const ceClient = new CostExplorerClient({
    region: "us-east-1", // Cost Explorer API is globally scoped to us-east-1
    credentials: tempCredentials,
  });

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const formattedToday = today.toISOString().split("T")[0];

  // If testing on the 1st of the month, look back 1 day to prevent API date bounds errors
  const adjustedStartDate = startOfMonth === formattedToday 
    ? new Date(today.setDate(today.getDate() - 1)).toISOString().split("T")[0]
    : startOfMonth;

  const command = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: adjustedStartDate,
      End: formattedToday,
    },
    Granularity: "MONTHLY",
    Metrics: ["UnblendedCost"],
  });

  const data = await ceClient.send(command);
  
  // Extract total amount
  const totalAmount = data.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount || "0.00";
  return parseFloat(totalAmount);
}
