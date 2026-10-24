import { getDb } from "@/lib/db";
import { ApiError, fail, json, readJson, requireAdmin } from "@/lib/api";
import { getTask } from "@/lib/queries";
import { nowIso } from "@/lib/time";
import { randomId } from "@/lib/password";

/**
 * 审核已提交的任务：
 *  - APPROVE：标记为已通过，版本保持有效，工时保留
 *  - REJECT：作废当前提交版本，任务退回进行中，标注员可修改后重新提交
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const task = getTask(admin, id);
    if (!task) throw new ApiError(404, "任务不存在或无权访问", "NOT_FOUND");

    const body = await readJson<{ decision?: string; comment?: string }>(req);
    const decision = body.decision;
    if (decision !== "APPROVE" && decision !== "REJECT") {
      throw new ApiError(422, "decision 必须是 APPROVE 或 REJECT", "VALIDATION");
    }
    const comment = (body.comment ?? "").trim().slice(0, 500);

    if (task.status !== "SUBMITTED") {
      throw new ApiError(409, "只有已提交的任务可以审核", "CONFLICT");
    }
    if (task.review_status === "APPROVED") {
      throw new ApiError(409, "该任务已经审核通过", "CONFLICT");
    }
    if (decision === "REJECT" && !comment) {
      throw new ApiError(422, "退回时请填写原因，方便标注员修改", "VALIDATION");
    }

    const db = getDb();
    const now = nowIso();

    db.transaction(() => {
      const row = db
        .prepare("SELECT status, review_status, tenant_id FROM tasks WHERE id = ?")
        .get(id) as { status: string; review_status: string; tenant_id: string } | undefined;
      if (!row || row.status !== "SUBMITTED" || row.review_status === "APPROVED") {
        throw new ApiError(409, "任务状态已变更，请刷新后重试", "CONFLICT");
      }

      if (decision === "APPROVE") {
        db.prepare(
          `UPDATE tasks SET review_status = 'APPROVED', reviewed_by = ?, reviewed_at = ?,
             review_comment = ?, updated_at = ? WHERE id = ?`,
        ).run(admin.id, now, comment || null, now, id);
      } else {
        // 作废当前提交版本 → 统计不再计入
        db.prepare("UPDATE submissions SET is_current = 0 WHERE task_id = ? AND is_current = 1").run(id);
        db.prepare(
          `UPDATE tasks SET status = 'IN_PROGRESS', review_status = 'REJECTED', reviewed_by = ?,
             reviewed_at = ?, review_comment = ?, submitted_at = NULL, submitted_date = NULL,
             updated_at = ? WHERE id = ?`,
        ).run(admin.id, now, comment, now, id);
      }

      db.prepare(
        "INSERT INTO audit_logs (id, tenant_id, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)",
      ).run(
        randomId("log"),
        row.tenant_id,
        admin.id,
        decision === "APPROVE" ? "TASK_APPROVED" : "TASK_REJECTED",
        "task",
        id,
        JSON.stringify({ comment }),
        now,
      );
    }).immediate();

    return json({ ok: true, reviewStatus: decision === "APPROVE" ? "APPROVED" : "REJECTED" });
  } catch (error) {
    return fail(error);
  }
}
