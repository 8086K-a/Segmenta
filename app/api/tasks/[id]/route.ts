import { getDb } from "@/lib/db";
import { canAccessTenant, isAdmin } from "@/lib/auth";
import { ApiError, fail, json, readJson, requireUser, str } from "@/lib/api";
import { getTask } from "@/lib/queries";
import { nowIso } from "@/lib/time";
import { randomId } from "@/lib/password";
import type { Segment } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const task = getTask(user, id);
    if (!task) throw new ApiError(404, "任务不存在或无权访问", "NOT_FOUND");

    const db = getDb();
    const segments = db
      .prepare("SELECT id, start_time AS start, end_time AS end, label FROM segments WHERE task_id = ? ORDER BY start_time")
      .all(id) as Segment[];

    const submission = db
      .prepare("SELECT * FROM submissions WHERE task_id = ? AND is_current = 1")
      .get(id) as
      | {
          id: string;
          version: number;
          submitted_at: string;
          submitted_date: string;
          total_duration: number;
          segment_count: number;
          segments_json: string;
          submitted_by: string;
        }
      | undefined;

    const history = db
      .prepare(
        `SELECT s.id, s.version, s.submitted_at, s.submitted_date, s.total_duration, s.segment_count,
                s.is_current, u.name AS submitted_by_name
           FROM submissions s JOIN users u ON u.id = s.submitted_by
          WHERE s.task_id = ? ORDER BY s.version DESC`,
      )
      .all(id);

    return json({ task, segments, submission, history });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (!isAdmin(user)) throw new ApiError(403, "需要管理员权限", "FORBIDDEN");
    const { id } = await ctx.params;
    const task = getTask(user, id);
    if (!task) throw new ApiError(404, "任务不存在或无权访问", "NOT_FOUND");

    const body = await readJson<{ title?: string; description?: string }>(req);
    const title = body.title !== undefined ? str(body.title, "任务名称", 120) : task.title;
    const description =
      body.description !== undefined ? (body.description ?? "").trim().slice(0, 2000) : task.description;

    getDb()
      .prepare("UPDATE tasks SET title = ?, description = ?, updated_at = ? WHERE id = ?")
      .run(title, description || null, nowIso(), id);

    return json({ task: getTask(user, id) });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (!isAdmin(user)) throw new ApiError(403, "需要管理员权限", "FORBIDDEN");
    const { id } = await ctx.params;
    const task = getTask(user, id);
    if (!task) throw new ApiError(404, "任务不存在或无权访问", "NOT_FOUND");

    const db = getDb();
    db.transaction(() => {
      db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
      db.prepare(
        "INSERT INTO audit_logs (id, tenant_id, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)",
      ).run(randomId("log"), task.tenant_id, user.id, "TASK_DELETED", "task", id, JSON.stringify({ title: task.title }), nowIso());
    }).immediate();

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
