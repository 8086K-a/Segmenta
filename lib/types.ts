export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
};

export type Segment = {
  id: string;
  start: number;
  end: number;
  label?: string | null;
};

export type TaskStatus = "AVAILABLE" | "IN_PROGRESS" | "SUBMITTED";
export type ReviewStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";
export type Role = "SUPER_ADMIN" | "ADMIN" | "ANNOTATOR";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  AVAILABLE: "待领取",
  IN_PROGRESS: "进行中",
  SUBMITTED: "已提交",
};

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  NONE: "未提交",
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已退回",
};

/** 列表/徽标用的复合状态：审核态优先于任务态 */
export type DisplayStatus = TaskStatus | "PENDING" | "APPROVED" | "REJECTED";

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "平台管理员",
  ADMIN: "租户管理员",
  ANNOTATOR: "标注员",
};

export type VideoRow = {
  id: string;
  tenant_id: string;
  filename: string;
  storage_key: string;
  mime_type: string;
  size: number;
  duration: number | null;
  created_at: string;
};

export type TaskRow = {
  id: string;
  tenant_id: string;
  video_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  claimed_at: string | null;
  submitted_at: string | null;
  submitted_date: string | null;
  revision: number;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
};

export type TaskSummary = TaskRow & {
  video_filename: string;
  video_duration: number | null;
  assignee_name: string | null;
  segment_count: number;
  draft_duration: number;
  submission_duration: number | null;
  submission_segments: number | null;
  tenant_name: string;
};

export type SubmissionRow = {
  id: string;
  task_id: string;
  version: number;
  submitted_by: string;
  submitted_at: string;
  submitted_date: string;
  total_duration: number;
  segment_count: number;
  segments_json: string;
  is_current: number;
};
