import { getDb } from "./db";
import { canAccessTenant, tenantScope, type SessionUser } from "./auth";
import type { TaskStatus, TaskSummary, VideoRow } from "./types";
import { addDays, todayBizDate } from "./time";

function inClause(ids: string[]): string {
  return ids.map(() => "?").join(",");
}

export type TaskFilter = {
  scope?: "hall" | "mine" | "all";
  status?: TaskStatus | "ALL";
  review?: "PENDING" | "APPROVED" | "REJECTED" | "ALL";
  tenantId?: string | null;
  assigneeId?: string | null;
  q?: string;
  limit?: number;
};

export function listTasks(user: SessionUser, filter: TaskFilter = {}): TaskSummary[] {
  const scopeIds = tenantScope(user);
  if (scopeIds.length === 0) return [];

  const where: string[] = [];
  const params: unknown[] = [];

  // 租户范围：标注员固定本租户；管理员可在授权范围内筛选
  let tenantIds = scopeIds;
  if (filter.tenantId && canAccessTenant(user, filter.tenantId)) {
    tenantIds = [filter.tenantId];
  }
  where.push(`t.tenant_id IN (${inClause(tenantIds)})`);
  params.push(...tenantIds);

  const scope = filter.scope ?? "all";
  if (scope === "hall") {
    where.push("t.status = 'AVAILABLE'");
    where.push("t.assignee_id IS NULL");
  } else if (scope === "mine") {
    where.push("t.assignee_id = ?");
    params.push(user.id);
    where.push("t.status IN ('IN_PROGRESS','SUBMITTED')");
  }
  if (filter.status && filter.status !== "ALL" && scope !== "hall") {
    where.push("t.status = ?");
    params.push(filter.status);
  }
  if (filter.review && filter.review !== "ALL") {
    if (filter.review === "REJECTED") {
      where.push("t.status = 'IN_PROGRESS'");
    } else {
      where.push("t.status = 'SUBMITTED'");
    }
    where.push("t.review_status = ?");
    params.push(filter.review);
  }
  if (filter.assigneeId) {
    where.push("t.assignee_id = ?");
    params.push(filter.assigneeId);
  }
  if (filter.q) {
    where.push("(t.title LIKE ? OR v.filename LIKE ?)");
    const like = `%${filter.q}%`;
    params.push(like, like);
  }

  const sql = `
    SELECT t.*, v.filename AS video_filename, v.duration AS video_duration,
           u.name AS assignee_name, ten.name AS tenant_name,
           (SELECT COUNT(*) FROM segments s WHERE s.task_id = t.id) AS segment_count,
           (SELECT COALESCE(SUM(s.end_time - s.start_time), 0) FROM segments s WHERE s.task_id = t.id) AS draft_duration,
           sub.total_duration AS submission_duration,
           sub.segment_count AS submission_segments
      FROM tasks t
      JOIN videos v ON v.id = t.video_id
      JOIN tenants ten ON ten.id = t.tenant_id
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN submissions sub ON sub.task_id = t.id AND sub.is_current = 1
     WHERE ${where.join(" AND ")}
     ORDER BY CASE t.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'AVAILABLE' THEN 1 ELSE 2 END,
              t.created_at DESC
     LIMIT ?`;

  params.push(filter.limit ?? 200);
  return getDb().prepare(sql).all(...params) as TaskSummary[];
}

export function getTask(user: SessionUser, taskId: string): TaskSummary | null {
  const row = getDb()
    .prepare(
      `SELECT t.*, v.filename AS video_filename, v.duration AS video_duration,
              u.name AS assignee_name, ten.name AS tenant_name,
              (SELECT COUNT(*) FROM segments s WHERE s.task_id = t.id) AS segment_count,
              (SELECT COALESCE(SUM(s.end_time - s.start_time), 0) FROM segments s WHERE s.task_id = t.id) AS draft_duration,
              sub.total_duration AS submission_duration,
              sub.segment_count AS submission_segments
         FROM tasks t
         JOIN videos v ON v.id = t.video_id
         JOIN tenants ten ON ten.id = t.tenant_id
         LEFT JOIN users u ON u.id = t.assignee_id
         LEFT JOIN submissions sub ON sub.task_id = t.id AND sub.is_current = 1
        WHERE t.id = ?`,
    )
    .get(taskId) as TaskSummary | undefined;
  if (!row) return null;
  if (!canAccessTenant(user, row.tenant_id)) return null;
  return row;
}

export type DailyStat = { day: string; seconds: number; tasks: number; segments: number };

export function dailyStats(opts: {
  tenantIds: string[];
  from: string;
  to: string;
  annotatorId?: string | null;
  taskId?: string | null;
}): DailyStat[] {
  if (opts.tenantIds.length === 0) return [];
  const where = [
    "s.is_current = 1",
    `t.tenant_id IN (${inClause(opts.tenantIds)})`,
    "s.submitted_date >= ?",
    "s.submitted_date <= ?",
  ];
  const params: unknown[] = [...opts.tenantIds, opts.from, opts.to];
  if (opts.annotatorId) {
    where.push("s.submitted_by = ?");
    params.push(opts.annotatorId);
  }
  if (opts.taskId) {
    where.push("s.task_id = ?");
    params.push(opts.taskId);
  }

  return getDb()
    .prepare(
      `SELECT s.submitted_date AS day,
              ROUND(SUM(s.total_duration), 3) AS seconds,
              COUNT(*) AS tasks,
              SUM(s.segment_count) AS segments
         FROM submissions s
         JOIN tasks t ON t.id = s.task_id
        WHERE ${where.join(" AND ")}
        GROUP BY s.submitted_date
        ORDER BY s.submitted_date`,
    )
    .all(...params) as DailyStat[];
}

export type AnnotatorStat = { id: string; name: string; seconds: number; tasks: number; segments: number };

export function annotatorStats(tenantIds: string[], from: string, to: string): AnnotatorStat[] {
  if (tenantIds.length === 0) return [];
  return getDb()
    .prepare(
      `SELECT u.id, u.name, ROUND(SUM(s.total_duration), 3) AS seconds,
              COUNT(*) AS tasks, SUM(s.segment_count) AS segments
         FROM submissions s
         JOIN users u ON u.id = s.submitted_by
         JOIN tasks t ON t.id = s.task_id
        WHERE s.is_current = 1 AND t.tenant_id IN (${inClause(tenantIds)})
          AND s.submitted_date >= ? AND s.submitted_date <= ?
        GROUP BY u.id, u.name
        ORDER BY seconds DESC`,
    )
    .all(...tenantIds, from, to) as AnnotatorStat[];
}

export type TaskStatRow = {
  task_id: string;
  title: string;
  tenant_name: string;
  annotator: string;
  submitted_date: string;
  submitted_at: string;
  total_duration: number;
  segment_count: number;
  version: number;
};

export function taskStats(
  tenantIds: string[],
  from: string,
  to: string,
  annotatorId?: string | null,
): TaskStatRow[] {
  if (tenantIds.length === 0) return [];
  const params: unknown[] = [...tenantIds, from, to];
  let extra = "";
  if (annotatorId) {
    extra = " AND s.submitted_by = ?";
    params.push(annotatorId);
  }
  return getDb()
    .prepare(
      `SELECT s.task_id, t.title, ten.name AS tenant_name, u.name AS annotator,
              s.submitted_date, s.submitted_at, s.total_duration, s.segment_count, s.version
         FROM submissions s
         JOIN tasks t ON t.id = s.task_id
         JOIN tenants ten ON ten.id = t.tenant_id
         JOIN users u ON u.id = s.submitted_by
        WHERE s.is_current = 1 AND t.tenant_id IN (${inClause(tenantIds)})
          AND s.submitted_date >= ? AND s.submitted_date <= ?${extra}
        ORDER BY s.submitted_at DESC`,
    )
    .all(...params) as TaskStatRow[];
}

export type Overview = {
  todaySeconds: number;
  yesterdaySeconds: number;
  weekSeconds: number;
  monthSeconds: number;
  available: number;
  inProgress: number;
  submittedToday: number;
  submittedTotal: number;
  annotators: number;
  segmentsToday: number;
  pendingReview: number;
};

export function overview(user: SessionUser, tenantId?: string | null): Overview {
  const tenantIds = tenantId && canAccessTenant(user, tenantId) ? [tenantId] : tenantScope(user);
  const today = todayBizDate();
  const yesterday = addDays(today, -1);
  const weekStart = addDays(today, -6);
  const monthStart = addDays(today, -29);

  const daily = dailyStats({ tenantIds, from: monthStart, to: today });
  const map = new Map(daily.map((d) => [d.day, d]));
  const sum = (from: string) =>
    daily.filter((d) => d.day >= from).reduce((s, d) => s + d.seconds, 0);

  const counts = getDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available,
         SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress,
         SUM(CASE WHEN status = 'SUBMITTED' AND submitted_date = ? THEN 1 ELSE 0 END) AS submitted_today,
         SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) AS submitted_total,
         SUM(CASE WHEN status = 'SUBMITTED' AND review_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_review
       FROM tasks WHERE tenant_id IN (${inClause(tenantIds)})`,
    )
    .get(today, ...tenantIds) as {
    available: number | null;
    in_progress: number | null;
    submitted_today: number | null;
    submitted_total: number | null;
    pending_review: number | null;
  };

  const annotators = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM users WHERE role = 'ANNOTATOR' AND status = 'ACTIVE'
        AND tenant_id IN (${inClause(tenantIds)})`,
    )
    .get(...tenantIds) as { n: number };

  return {
    todaySeconds: map.get(today)?.seconds ?? 0,
    yesterdaySeconds: map.get(yesterday)?.seconds ?? 0,
    weekSeconds: sum(weekStart),
    monthSeconds: sum(monthStart),
    available: counts.available ?? 0,
    inProgress: counts.in_progress ?? 0,
    submittedToday: counts.submitted_today ?? 0,
    submittedTotal: counts.submitted_total ?? 0,
    annotators: annotators.n,
    segmentsToday: map.get(today)?.segments ?? 0,
    pendingReview: counts.pending_review ?? 0,
  };
}

export function listVideos(user: SessionUser, tenantId?: string | null): (VideoRow & { task_count: number; tenant_name: string })[] {
  const ids = tenantId && canAccessTenant(user, tenantId) ? [tenantId] : tenantScope(user);
  if (ids.length === 0) return [];
  return getDb()
    .prepare(
      `SELECT v.*, ten.name AS tenant_name,
              (SELECT COUNT(*) FROM tasks t WHERE t.video_id = v.id) AS task_count
         FROM videos v JOIN tenants ten ON ten.id = v.tenant_id
        WHERE v.tenant_id IN (${inClause(ids)})
        ORDER BY v.created_at DESC`,
    )
    .all(...ids) as (VideoRow & { task_count: number; tenant_name: string })[];
}

export function listUsers(user: SessionUser, tenantId?: string | null) {
  const ids = tenantId && canAccessTenant(user, tenantId) ? [tenantId] : tenantScope(user);
  if (ids.length === 0) return [];
  return getDb()
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.tenant_id, u.created_at,
              t.name AS tenant_name,
              (SELECT COUNT(*) FROM tasks k WHERE k.assignee_id = u.id AND k.status = 'SUBMITTED') AS submitted_count,
              (SELECT COALESCE(SUM(s.total_duration),0) FROM submissions s
                 WHERE s.submitted_by = u.id AND s.is_current = 1) AS total_seconds
         FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE u.tenant_id IN (${inClause(ids)})
        ORDER BY u.role, u.created_at`,
    )
    .all(...ids) as {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    tenant_id: string;
    created_at: string;
    tenant_name: string;
    submitted_count: number;
    total_seconds: number;
  }[];
}

export function listTenants(user: SessionUser) {
  const ids = tenantScope(user);
  if (ids.length === 0) return [];
  return getDb()
    .prepare(
      `SELECT t.id, t.name, t.slug, t.status, t.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS user_count,
              (SELECT COUNT(*) FROM tasks k WHERE k.tenant_id = t.id) AS task_count,
              (SELECT COALESCE(SUM(s.total_duration),0) FROM submissions s
                 JOIN tasks k ON k.id = s.task_id
                WHERE k.tenant_id = t.id AND s.is_current = 1) AS total_seconds
         FROM tenants t WHERE t.id IN (${inClause(ids)})
        ORDER BY t.created_at`,
    )
    .all(...ids) as {
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: string;
    user_count: number;
    task_count: number;
    total_seconds: number;
  }[];
}

export function recentActivity(user: SessionUser, limit = 8) {
  const ids = tenantScope(user);
  if (ids.length === 0) return [];
  return getDb()
    .prepare(
      `SELECT s.submitted_at, s.total_duration, s.segment_count, s.version,
              t.id AS task_id, t.title, u.name AS annotator, ten.name AS tenant_name
         FROM submissions s
         JOIN tasks t ON t.id = s.task_id
         JOIN users u ON u.id = s.submitted_by
         JOIN tenants ten ON ten.id = t.tenant_id
        WHERE s.is_current = 1 AND t.tenant_id IN (${inClause(ids)})
        ORDER BY s.submitted_at DESC LIMIT ?`,
    )
    .all(...ids, limit) as {
    submitted_at: string;
    total_duration: number;
    segment_count: number;
    version: number;
    task_id: string;
    title: string;
    annotator: string;
    tenant_name: string;
  }[];
}
