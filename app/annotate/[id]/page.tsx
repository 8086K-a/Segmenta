import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getTask, listTasks } from "@/lib/queries";
import { StudioWorkspace, type StudioTask } from "@/components/studio/StudioWorkspace";
import type { StudioSegment } from "@/components/studio/TimelineEditor";

export const dynamic = "force-dynamic";

export default async function AnnotatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const task = getTask(user, id);
  if (!task) notFound();
  if (task.tenant_id !== user.tenantId && user.role !== "SUPER_ADMIN") notFound();
  if (task.status === "AVAILABLE" && !task.assignee_id) redirect("/hall");
  if (user.role === "ANNOTATOR" && task.assignee_id !== user.id) redirect("/my-tasks");

  const db = getDb();
  const submission = db
    .prepare(
      "SELECT version, submitted_at, total_duration, segment_count, segments_json FROM submissions WHERE task_id = ? AND is_current = 1",
    )
    .get(id) as
    | {
        version: number;
        submitted_at: string;
        total_duration: number;
        segment_count: number;
        segments_json: string;
      }
    | undefined;

  const editable = task.status === "IN_PROGRESS" && task.assignee_id === user.id;

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

  // 工作台内可直接切换的任务（进行中 + 已提交）
  const switchable = listTasks(user, { scope: user.role === "ANNOTATOR" ? "mine" : "all", limit: 80 })
    .filter((t) => t.status !== "AVAILABLE")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "IN_PROGRESS" ? -1 : 1;
      return b.updated_at.localeCompare(a.updated_at);
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as "IN_PROGRESS" | "SUBMITTED",
      segments: t.status === "SUBMITTED" ? (t.submission_segments ?? 0) : t.segment_count,
      seconds: t.status === "SUBMITTED" ? (t.submission_duration ?? 0) : t.draft_duration,
    }));

  const studioTask: StudioTask = {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    tenantName: task.tenant_name,
    assigneeName: task.assignee_name,
    videoId: task.video_id,
    videoFilename: task.video_filename,
    videoDuration: task.video_duration,
    editable,
    reviewStatus: task.review_status,
    reviewComment: task.review_comment,
    reviewedAt: task.reviewed_at,
    submission: submission
      ? {
          version: submission.version,
          totalDuration: submission.total_duration,
          segmentCount: submission.segment_count,
          submittedAt: submission.submitted_at,
        }
      : null,
  };

  return (
    <StudioWorkspace
      task={studioTask}
      initialSegments={segments}
      backHref={user.role === "ANNOTATOR" ? "/my-tasks" : "/studio"}
      switchable={switchable}
      listHref={user.role === "ANNOTATOR" ? "/my-tasks" : "/studio"}
    />
  );
}
