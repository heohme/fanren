export type SubmissionType = "creator" | "work" | "correction";
export type SubmissionStatus = "pending" | "reviewing" | "approved" | "rejected" | "duplicate" | "needs_info" | "withdrawn";

export interface CommunityItem {
  id: string;
  type: Exclude<SubmissionType, "correction">;
  targetUrl: string;
  targetKey: string;
  upUid: string | null;
  upName: string | null;
  title: string | null;
  episode: number | null;
  category: string | null;
  recommendationReason: string | null;
  approvedAt: string;
}

export interface SubmissionReceipt {
  id: string;
  receiptToken: string;
  status: SubmissionStatus;
  publicNote?: string | null;
  createdAt: string;
}

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: "待审核",
  reviewing: "审核中",
  approved: "已收录",
  rejected: "未收录",
  duplicate: "已有相同内容",
  needs_info: "需要补充",
  withdrawn: "已撤回",
};
