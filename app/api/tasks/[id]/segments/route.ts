import { getDb } from "@/lib/db";
import { ApiError, fail, json, readJson, requireUser } from "@/lib/api";
import { getTask } from "@/lib/queries";
import { normalizeSegments, type InputSegment } from "@/lib/segments";
import { nowIso } from "@/lib/time";
import { randomId } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const task = getTask(user, id);
    if (!task) throw new ApiError(404, "任务不存在或无权访问", "NOT_FOUND");

    const segments = getDb()
      .prepare(
        "SELECT id, start_time AS start, end_time AS end, label FROM segments WHERE task_id = ? ORDER BY start_time",
      )
      .all(id);

    return json({ segments, editable: task.status === "IN_PROGRESS" && task.assignee_id === user.id });
  } catch (error) {
    return fail(error);
  }
}

/** 保存草稿：整表替换，事务内完成，避免并发写入产生重叠 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const task = getTask(user, id);
    if (!task) throw new ApiError(404, "任务不存在或无权访问", "NOT_FOUND");
    if (task.status === "SUBMITTED") {
      throw new ApiError(409, "任务已提交，如需修改请联系管理员退回", "LOCKED");
    }
    if (task.assignee_id !== user.id) {
      throw new ApiError(403, "只有任务领取人可以编辑标注", "FORBIDDEN");
    }

    const body = await readJson<{ segments?: InputSegment[] }>(req);
    const segments = normalizeSegments(body.segments, task.video_duration);

    const db = getDb();
    const now = nowIso();
    db.transaction(() => {
      const current = db.prepare("SELECT status FROM tasks WHERE id = ?").get(id) as { status: string };
      if (current.status !== "IN_PROGRESS") {
        throw new ApiError(409, "任务状态已变更，请刷新后重试", "CONFLICT");
      }
      db.prepare("DELETE FROM segments WHERE task_id = ?").run(id);
      const insert = db.prepare(
        "INSERT INTO segments (id, task_id, start_time, end_time, label, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
      );
      for (const s of segments) {
        insert.run(randomId("seg"), id, s.start, s.end, s.label, now, now);
      }
      db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").run(now, id);
    }).immediate();

    return json({ ok: true, segments, savedAt: now });
  } catch (error) {
    return fail(error);
  }
}
