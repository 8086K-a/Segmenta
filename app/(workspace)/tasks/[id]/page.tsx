import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getTask } from "@/lib/queries";
import { formatClock, formatDateTime, formatHuman } from "@/lib/time";
import { Avatar, Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { TaskActions } from "@/components/TaskActions";
import { SubmissionHistory, TaskReview } from "@/components/TaskReview";
import type { StudioSegment } from "@/components/studio/TimelineEditor";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "ANNOTATOR") redirect("/my-tasks");

  const { id } = await params;
  const task = getTask(user, id);
  if (!task) notFound();

  const db = getDb();
  const submission = db
    .prepare("SELECT * FROM submissions WHERE task_id = ? AND is_current = 1")
    .get(id) as
    | {
        version: number;
        submitted_at: string;
        submitted_date: string;
        total_duration: number;
        segment_count: number;
        segments_json: string;
      }
    | undefined;

  const history = db
    .prepare(
      `SELECT s.id, s.version, s.submitted_at, s.total_duration, s.segment_count, s.is_current,
              u.name AS submitted_by_name
         FROM submissions s JOIN users u ON u.id = s.submitted_by
        WHERE s.task_id = ? ORDER BY s.version DESC`,
    )
    .all(id) as {
    id: string;
    version: number;
    submitted_at: string;
    total_duration: number;
    segment_count: number;
    is_current: number;
    submitted_by_name: string;
  }[];

  const segments: StudioSegment[] =
    task.status === "SUBMITTED" && submission
      ? (JSON.parse(submission.segments_json) as { start: number; end: number; label?: string | null }[]).map(
          (s, i) => ({ id: `s${i}`, start: s.start, end: s.end, label: s.label ?? null }),
        )
      : (db
          .prepare(
            "SELECT id, start_time AS start, end_time AS end, label FROM segments WHERE task_id = ? ORDER BY start_time",
          )
          .all(id) as StudioSegment[]);

  const duration = task.video_duration ?? 0;
  const reviewer = task.reviewed_by
    ? (db.prepare("SELECT name FROM users WHERE id = ?").get(task.reviewed_by) as { name: string } | undefined)
    : undefined;

  return (
    <>
      <PageHeader
        backHref="/tasks"
        backLabel="返回任务列表"
        title={task.title}
        subtitle={task.description || undefined}
        meta={<StatusBadge status={task.status} reviewStatus={task.review_status} />}
        actions={
          <>
            <Link
              href={`/annotate/${task.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              打开工作台
            </Link>
            <TaskActions taskId={task.id} status={task.status} reviewStatus={task.review_status} />
          </>
        }
      />

      <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <TaskReview videoId={task.video_id} duration={duration} segments={segments} />
        </div>

        <aside className="space-y-3">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">任务信息</span>
              <StatusBadge status={task.status} reviewStatus={task.review_status} />
            </div>
            <dl className="space-y-2.5 text-xs">
              <Row label="租户" value={task.tenant_name} />
              <Row label="视频" value={task.video_filename} mono />
              <Row label="视频时长" value={duration ? formatClock(duration) : "—"} />
              <Row label="创建时间" value={formatDateTime(task.created_at)} />
              {task.assignee_name && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">标注员</dt>
                  <dd className="flex items-center gap-1.5">
                    <Avatar name={task.assignee_name} size={16} />
                    <span>{task.assignee_name}</span>
                  </dd>
                </div>
              )}
              {task.claimed_at && <Row label="领取时间" value={formatDateTime(task.claimed_at)} />}
            </dl>
          </Card>

          {submission && (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">有效时长</span>
                <Badge tone="success">已计入统计</Badge>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="tnum text-[1.6rem] font-medium leading-none tracking-[-0.02em]">
                  {submission.total_duration.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">秒</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatHuman(submission.total_duration)} · {submission.segment_count} 个片段
              </div>
              <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
                <Row label="提交版本" value={`v${submission.version}`} />
                <Row label="计入日期" value={submission.submitted_date} />
                <Row label="提交时间" value={formatDateTime(submission.submitted_at)} />
              </div>
            </Card>
          )}

          {task.review_status !== "NONE" && (
            <Card className="p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-sm font-medium">审核</span>
                <Badge tone={task.review_status === "APPROVED" ? "success" : task.review_status === "REJECTED" ? "danger" : "primary"}>
                  {task.review_status === "APPROVED" ? "已通过" : task.review_status === "REJECTED" ? "已退回" : "待审核"}
                </Badge>
              </div>
              {task.review_status === "PENDING" ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  等待审核。审核不通过会退回给标注员修改，该版本从工时统计中移除。
                </p>
              ) : (
                <dl className="space-y-2 text-xs">
                  <Row label="审核人" value={reviewer?.name ?? "—"} />
                  <Row label="审核时间" value={formatDateTime(task.reviewed_at)} />
                </dl>
              )}
              {task.review_comment && (
                <p
                  className={`mt-2.5 rounded-md px-2 py-1.5 text-xs leading-relaxed ${
                    task.review_status === "REJECTED"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted/60 text-muted-foreground"
                  }`}
                >
                  {task.review_comment}
                </p>
              )}
            </Card>
          )}

          <SubmissionHistory history={history} />

          {task.status === "IN_PROGRESS" && (
            <div className="rounded-lg border border-border bg-accent/25 p-3 text-xs leading-relaxed text-muted-foreground">
              该任务仍在标注中，草稿共 {task.segment_count} 个片段（{task.draft_duration.toFixed(1)} 秒），未提交前不计入有效时长。
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 truncate text-right ${mono ? "font-mono text-[10.5px]" : ""}`}>{value}</dd>
    </div>
  );
}
