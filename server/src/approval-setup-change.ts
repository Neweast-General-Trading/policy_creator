import { listPolicies, savePolicy } from "./policies-store.js";
import { setupMatchesDepartment } from "./approval-setup-companies.js";
import type { PolicyApprovalSetup } from "./approval-setup-types.js";
import type { StoredPolicy } from "./workflow-types.js";
import { sendTeamsNotification } from "./teams-notify.js";

function normalizeSetupForCompare(setup: PolicyApprovalSetup) {
  return {
    submitterLevelMode: setup.submitterLevelMode,
    hodSkipInternalLevels: setup.hodSkipInternalLevels,
    stages: setup.stages,
  };
}

export function approvalSetupContentChanged(
  before: PolicyApprovalSetup,
  after: PolicyApprovalSetup,
) {
  return (
    JSON.stringify(normalizeSetupForCompare(before)) !==
    JSON.stringify(normalizeSetupForCompare(after))
  );
}

function buildSetupRefreshTeamsMessage(policy: StoredPolicy, setup: PolicyApprovalSetup) {
  const appUrl = (process.env.CLIENT_URL || "https://policycreator.neweast.cloud").replace(
    /\/$/,
    "",
  );
  return `Hi ${policy.createdByName},

The approval matrix for ${setup.sourceDepartmentName} (${setup.companyName}) was updated by IT.

Your policy "${policy.name}" (v${policy.version}) may need to reflect the new approval setup.

Update matrix: ${appUrl}/?policy=${policy.id}&setupRefresh=1

Regards,
Business Systems`;
}

async function markPolicyPendingSetupRefresh(
  policy: StoredPolicy,
  setup: PolicyApprovalSetup,
) {
  const updated: StoredPolicy = {
    ...policy,
    pendingSetupRefresh: {
      setupId: setup.id,
      setupUpdatedAt: setup.updatedAt,
      notifiedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
  await savePolicy(updated);
  await sendTeamsNotification({
    name: policy.createdByName,
    mailId: policy.createdByEmail,
    desc: buildSetupRefreshTeamsMessage(policy, setup),
  });
}

export async function notifyPoliciesOnApprovalSetupChange(
  previous: PolicyApprovalSetup,
  updated: PolicyApprovalSetup,
) {
  if (!approvalSetupContentChanged(previous, updated)) return;

  const policies = await listPolicies();
  const affected = policies.filter(
    (policy) =>
      setupMatchesDepartment(
        updated,
        policy.companyCode,
        policy.departmentCode,
        policy.departmentName,
      ) &&
      policy.status !== "draft" &&
      policy.approvalSteps.length > 0,
  );

  for (const policy of affected) {
    await markPolicyPendingSetupRefresh(policy, updated);
  }
}
