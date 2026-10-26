import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  CopyPlus,
  Download,
  Edit,
  Eye,
  Globe,
  MessageSquare,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import PolicyDocumentView from "@/components/viewer/PolicyDocumentView";
import ApprovalSidebar from "@/components/workflow/ApprovalSidebar";
import EditMatrixDialog from "@/components/workflow/EditMatrixDialog";
import MatrixChangeReviewPanel from "@/components/workflow/MatrixChangeReviewPanel";
import SubmitApprovalDialog from "@/components/workflow/SubmitApprovalDialog";
import ElectronicSignatureDialog from "@/components/workflow/ElectronicSignatureDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useCopyProtection } from "@/hooks/useCopyProtection";
import {
  approvePolicyApi,
  commentPolicyApi,
  escalatePolicyApi,
  fetchPolicy,
  publishPolicyApi,
  rejectPolicyApi,
  submitPolicyApi,
} from "@/lib/api";
import EscalateDialog from "@/components/workflow/EscalateDialog";
import { downloadPolicyPdf, openPolicyInBrowser } from "@/lib/pdf";
import PolicyStatusDot from "@/components/policies/PolicyStatusDot";
import { getPolicyStatusLabel } from "@/lib/policy-status";
import type { AdditionalApproverDraft, Policy, SubmitterLevelMode } from "@/lib/types";
import { formatPolicyScopeLabel } from "@/lib/policy-companies";
import { cn, formatDate } from "@/lib/utils";

interface PolicyViewerProps {
  policy: Policy;
  onEdit: () => void;
  onDuplicate: () => void;
  onNewVersion?: () => void;
  onDeactivate?: () => void;
  onActivate?: () => void;
  onUpdated?: (policy: Policy) => void;
  canDeleteAnyPolicy?: boolean;
  onDelete?: () => void;
  canDeactivateAnyPolicy?: boolean;
  canEditAnyPolicy?: boolean;
}

export default function PolicyViewer({
  policy: initialPolicy,
  onEdit,
  onDuplicate,
  onNewVersion,
  onDeactivate,
  onActivate,
  onUpdated,
  canDeleteAnyPolicy = false,
  canDeactivateAnyPolicy = false,
  canEditAnyPolicy = false,
  onDelete,
}: PolicyViewerProps) {
  useCopyProtection(true);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [signatureText, setSignatureText] = useState("");
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [generalComment, setGeneralComment] = useState("");
  const [isActing, setIsActing] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [editMatrixOpen, setEditMatrixOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: policy = initialPolicy } = useQuery({
    queryKey: ["policy", initialPolicy.id],
    queryFn: () => fetchPolicy(initialPolicy.id),
    initialData: initialPolicy,
  });

  const userEmail = user?.email?.toLowerCase() ?? "";
  const isOwner = policy.createdByEmail.toLowerCase() === userEmail;
  const canEditPolicy =
    (isOwner || canEditAnyPolicy) &&
    policy.status !== "approved" &&
    policy.status !== "published" &&
    (policy.status === "draft" ||
      policy.status === "returned" ||
      policy.status === "in_approval");
  const canSubmit = isOwner && (policy.status === "draft" || policy.status === "returned");
  const canProposeMatrixChange =
    isOwner &&
    ["in_approval", "returned"].includes(policy.status) &&
    policy.approvalSteps.length > 0 &&
    !policy.pendingMatrixChange;
  const canReviewMatrixChange =
    policy.pendingMatrixChange?.status === "pending" &&
    policy.pendingMatrixChange.reviewerEmail.toLowerCase() === userEmail;
  const canApprove = policy.currentApprovers.some(
    (step) => step.assigneeEmail.toLowerCase() === userEmail,
  );
  const canPublish = isOwner && policy.status === "approved";
  const canNewVersion =
    isOwner && policy.status === "published" && typeof onNewVersion === "function";
  const canDeactivate =
    (isOwner || canDeactivateAnyPolicy) &&
    policy.status === "published" &&
    policy.isActive !== false &&
    typeof onDeactivate === "function";
  const canActivate =
    (isOwner || canDeactivateAnyPolicy) &&
    policy.status === "published" &&
    policy.isActive === false &&
    typeof onActivate === "function";
  const canDelete =
    Boolean(onDelete) &&
    (canDeleteAnyPolicy || (isOwner && policy.status === "draft"));

  const refreshPolicy = async (updated: Policy) => {
    queryClient.setQueryData(["policy", updated.id], updated);
    await queryClient.invalidateQueries({ queryKey: ["policies"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    onUpdated?.(updated);
  };

  const handleEscalate = async (payload: {
    targetEmail: string;
    targetName: string;
    targetUserId?: string;
    reason: string;
  }) => {
    setIsActing(true);
    try {
      const updated = await escalatePolicyApi(policy.id, payload);
      setEscalateDialogOpen(false);
      await refreshPolicy(updated);
      toast.success("Policy escalated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to escalate");
    } finally {
      setIsActing(false);
    }
  };

  const handleApprove = async (signedName?: string) => {
    const signature = (signedName ?? signatureText).trim();
    if (!signature) {
      setSignatureDialogOpen(true);
      return;
    }
    setIsActing(true);
    try {
      const updated = await approvePolicyApi(policy.id, {
        signatureText: signature,
        comment: approvalComment.trim() || undefined,
      });
      setSignatureText("");
      setSignatureDialogOpen(false);
      setApprovalComment("");
      await refreshPolicy(updated);
      toast.success("Policy approved and signed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    setIsActing(true);
    try {
      const updated = await rejectPolicyApi(
        policy.id,
        rejectComment.trim() || "Returned for revision",
      );
      setRejectComment("");
      await refreshPolicy(updated);
      toast.success("Policy returned to requester");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject");
    } finally {
      setIsActing(false);
    }
  };

  const handleComment = async () => {
    if (!generalComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }
    setIsActing(true);
    try {
      const updated = await commentPolicyApi(policy.id, generalComment.trim());
      setGeneralComment("");
      await refreshPolicy(updated);
      toast.success("Comment added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add comment");
    } finally {
      setIsActing(false);
    }
  };

  const handlePublish = async () => {
    setIsActing(true);
    try {
      const updated = await publishPolicyApi(policy.id);
      await refreshPolicy(updated);
      toast.success("Policy published successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish policy");
    } finally {
      setIsActing(false);
    }
  };

  const handleConfirmSubmit = async (payload: {
    additionalApprovers: AdditionalApproverDraft[];
    submitterLevelMode: SubmitterLevelMode;
  }) => {
    setIsSubmitting(true);
    try {
      const updated = await submitPolicyApi(
        policy.id,
        payload.additionalApprovers,
        payload.submitterLevelMode,
      );
      setSubmitDialogOpen(false);
      await refreshPolicy(updated);
      toast.success(
        updated.status === "approved"
          ? "Policy approved automatically — no further approvers were required"
          : "Policy submitted for approval",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit policy");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full min-h-[calc(100vh-64px)]">
      <div className="min-w-0 flex-1 space-y-4 p-3 md:p-5 lg:pe-4">
        <div className="xl:hidden">
          <ApprovalSidebar policy={policy} userEmail={userEmail} />
        </div>

        <div className="app-surface rounded-lg p-3 md:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <PolicyStatusDot status={policy.status} size="md" showRing />
                  <h2 className="text-lg font-bold text-slate-900">{policy.name}</h2>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    v{policy.version}
                  </span>
                  {policy.isActive === false ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      Inactive
                    </span>
                  ) : null}
                  <span className="sr-only">{getPolicyStatusLabel(policy.status)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatPolicyScopeLabel(policy)} · {policy.createdByName} ·{" "}
                  {formatDate(policy.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {canPublish && (
                  <Button type="button" onClick={handlePublish} disabled={isActing}>
                    <Globe className="h-4 w-4" />
                    Publish
                  </Button>
                )}
                {canSubmit && (
                  <Button type="button" onClick={() => setSubmitDialogOpen(true)} disabled={isActing || isSubmitting}>
                    <Send className="h-4 w-4" />
                    Submit for Approval
                  </Button>
                )}
                {canProposeMatrixChange && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditMatrixOpen(true)}
                    disabled={isActing}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Edit Matrix
                  </Button>
                )}
                {canNewVersion && (
                  <Button type="button" variant="outline" onClick={onNewVersion} disabled={isActing}>
                    <CopyPlus className="h-4 w-4" />
                    New Version
                  </Button>
                )}
                {canDeactivate && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-200 text-amber-800 hover:bg-amber-50"
                    onClick={onDeactivate}
                    disabled={isActing}
                  >
                    <XCircle className="h-4 w-4" />
                    Deactivate
                  </Button>
                )}
                {canActivate && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    onClick={onActivate}
                    disabled={isActing}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Activate
                  </Button>
                )}
                {canEditPolicy && (
                  <Button type="button" variant="outline" onClick={onEdit}>
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={onDuplicate}>
                  <Copy className="h-4 w-4" />
                  Duplicate
                </Button>
                {canDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={onDelete}
                    disabled={isActing}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                )}
                <Button
                  type="button"
                  variant="blue"
                  onClick={async () => {
                    try {
                    await downloadPolicyPdf(policy);
                    toast.success("Use the print dialog and choose Save as PDF");
                    } catch {
                      toast.error("Failed to generate PDF");
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    openPolicyInBrowser(policy);
                    toast.info("Policy opened in new tab");
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
              </div>
            </div>
          </div>

          {canReviewMatrixChange && (
            <MatrixChangeReviewPanel policy={policy} onUpdated={refreshPolicy} />
          )}

          {policy.pendingMatrixChange?.status === "pending" && isOwner && !canReviewMatrixChange && (
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/70 px-4 py-3 text-sm text-sky-900">
              Matrix update pending approval from{" "}
              <span className="font-semibold">{policy.pendingMatrixChange.reviewerName}</span>.
            </div>
          )}

          {canPublish && (
            <div className="app-surface rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 p-4 md:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-emerald-900">Ready to Publish</h3>
                  <p className="mt-1 text-sm text-emerald-800/80">
                    All approvals are complete. Publish to make this policy official.
                  </p>
                </div>
                <Button type="button" onClick={handlePublish} disabled={isActing} className="shrink-0">
                  <Globe className="h-4 w-4" />
                  {isActing ? "Publishing..." : "Publish Policy"}
                </Button>
              </div>
            </div>
          )}

          {policy.status === "published" && (
            <div className="rounded-xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 to-sky-50/60 px-4 py-3 text-sm text-blue-800">
              <span className="font-semibold">Published</span>
              {policy.publishedAt ? ` · ${formatDate(policy.publishedAt)}` : ""}
            </div>
          )}

          {canApprove && (
            <div className="app-surface space-y-4 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 p-4 md:p-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Your Review</h3>
                <p className="text-sm text-slate-600">
                  Approve with your signature, or return to the requester for changes.
                </p>
              </div>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="approval-comment">Comment (optional)</Label>
                  <textarea
                    id="approval-comment"
                    value={approvalComment}
                    onChange={(event) => setApprovalComment(event.target.value)}
                    placeholder="Add review notes..."
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => setSignatureDialogOpen(true)}
                  disabled={isActing}
                >
                  <Send className="h-4 w-4" />
                  Approve & Sign
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEscalateDialogOpen(true)}
                  disabled={isActing}
                >
                  Escalate
                </Button>
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="reject-comment">Return reason</Label>
                    <Input
                      id="reject-comment"
                      value={rejectComment}
                      onChange={(event) => setRejectComment(event.target.value)}
                      placeholder="Explain what needs to be changed"
                      className="bg-white"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReject}
                    disabled={isActing}
                  >
                    <XCircle className="h-4 w-4" />
                    Return
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="app-surface rounded-xl p-4 md:p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <MessageSquare className="h-5 w-5" />
              Comments
            </h3>
            {policy.comments.length === 0 ? (
              <p className="mb-4 text-sm text-slate-500">No comments yet.</p>
            ) : (
              <div className="mb-4 space-y-3">
                {policy.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={cn(
                      "rounded-lg border px-4 py-3",
                      comment.type === "escalation"
                        ? "border-amber-200 bg-amber-50"
                        : comment.type === "matrix_change"
                          ? "border-sky-200 bg-sky-50"
                          : "border-slate-200 bg-slate-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {comment.authorName}
                        {comment.type === "escalation"
                          ? " · Escalation"
                          : comment.type === "matrix_change"
                            ? " · Matrix update"
                            : ""}
                      </span>
                      <span>{formatDate(comment.createdAt)}</span>
                    </div>
                    {comment.type === "escalation" && comment.targetName ? (
                      <p className="mt-1 text-xs font-medium text-amber-800">
                        To: {comment.targetName}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-slate-700">{comment.text}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                value={generalComment}
                onChange={(event) => setGeneralComment(event.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              />
              <Button type="button" variant="outline" onClick={handleComment} disabled={isActing}>
                Post Comment
              </Button>
            </div>
          </div>

          <div className="app-surface no-copy rounded-lg p-6 md:p-10">
            <PolicyDocumentView policy={policy} />
          </div>
      </div>

      <aside className="hidden w-[360px] shrink-0 flex-col border-l border-slate-200/80 bg-gradient-to-b from-slate-50/40 via-white to-violet-50/10 xl:flex">
        <div className="sticky top-0 max-h-[calc(100vh-64px)] overflow-y-auto p-4">
          <ApprovalSidebar policy={policy} userEmail={userEmail} />
        </div>
      </aside>

      <SubmitApprovalDialog
        open={submitDialogOpen}
        policy={{
          companyCode: policy.companyCode,
          departmentCode: policy.departmentCode,
          departmentName: policy.departmentName,
        }}
        isSubmitting={isSubmitting}
        onClose={() => {
          if (isSubmitting) return;
          setSubmitDialogOpen(false);
        }}
        onConfirm={handleConfirmSubmit}
      />

      <EditMatrixDialog
        open={editMatrixOpen}
        policy={policy}
        onClose={() => setEditMatrixOpen(false)}
        onSaved={refreshPolicy}
      />

      <EscalateDialog
        open={escalateDialogOpen}
        policyId={policy.id}
        companyCode={policy.companyCode}
        isSubmitting={isActing}
        onClose={() => setEscalateDialogOpen(false)}
        onConfirm={handleEscalate}
      />

      <ElectronicSignatureDialog
        open={signatureDialogOpen}
        defaultName={user?.name ?? signatureText}
        isSubmitting={isActing}
        onClose={() => setSignatureDialogOpen(false)}
        onConfirm={(name) => {
          setSignatureText(name);
          void handleApprove(name);
        }}
      />
    </div>
  );
}
