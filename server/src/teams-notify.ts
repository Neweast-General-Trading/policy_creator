export async function sendTeamsNotification(input: {
  name: string;
  mailId: string;
  desc: string;
}) {
  const teamsApi = process.env.TEAMS_API?.trim();
  if (!teamsApi || !input.mailId) return;

  try {
    const url = new URL(teamsApi);
    url.searchParams.set("Name", input.name || "");
    url.searchParams.set("MailID", input.mailId || "");
    url.searchParams.set("Desc", input.desc || "");
    await fetch(url.toString(), { method: "POST" });
  } catch (error) {
    console.warn("[Teams]", error instanceof Error ? error.message : error);
  }
}

export function buildPolicyApprovalTeamsMessage(input: {
  approverName: string;
  requesterName: string;
  policyName: string;
  policyId: string;
  version: number;
}) {
  const appUrl = (process.env.CLIENT_URL || "https://policycreator.neweast.cloud").replace(/\/$/, "");
  return `Hi ${input.approverName},

You have received a new policy document "${input.policyName}" (v${input.version}) from ${input.requesterName} that requires your review and approval.

View Policy: ${appUrl}/?policy=${input.policyId}

Regards,
Business Systems`;
}
