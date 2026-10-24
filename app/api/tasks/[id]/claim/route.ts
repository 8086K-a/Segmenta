import { getDb } from "@/lib/db";
import { ApiError, fail, json, requireAnnotator } from "@/lib/api";
import { nowIso } from "@/lib/time";
import { randomId } from "@/lib/password";
import type { TaskRow } from "@/lib/types";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAnnotator();
    const { id } = await ctx.params;
    const db = getDb();

    const task = db.transaction(() => {
      const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
      // 跨租户一律按“不存在”处理，避免通过状态码探测其他租户的数据
      if (!row || row.tenant_id !== user.tenantId) throw new ApiError(404, "任务不存在", "NOT_FOUND");
      if (row.status === "SUBMITTED") throw new ApiError(409, "任务已提交，无法领取", "CONFLICT");
      if (row.assignee_id && row.assignee_id !== user.id) {
        throw new ApiError(409, "该任务已被其他标注员领取", "CONFLICT");
      }
      if (row.assignee_id === user.id) return row; // 幂等：重复领取直接返回

      const now = nowIso();
      const result = db
        .prepare(
          `UPDATE tasks SET status = 'IN_PROGRESS', assignee_id = ?, claimed_at = ?, updated_at = ?
            WHERE id = ? AND status = 'AVAILABLE' AND assignee_id IS NULL`,
        )
        .run(user.id, now, now, id);

      if (result.changes !== 1) throw new ApiError(409, "任务刚刚被其他标注员领取", "CONFLICT");

      db.prepare(
        "INSERT INTO audit_logs (id, tenant_id, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)",
      ).run(randomId("log"), row.tenant_id, user.id, "TASK_CLAIMED", "task", id, null, now);

      return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow;
    }).immediate();

    return json({ ok: true, task });
  } catch (error) {
    return fail(error);
  }
}
