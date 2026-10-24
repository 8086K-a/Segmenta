import { getDb } from "@/lib/db";
import { ApiError, fail, json, readJson, requireUser } from "@/lib/api";
import { getTask } from "@/lib/queries";
import { normalizeSegments, totalDuration, type InputSegment } from "@/lib/segments";
import { bizDate, nowIso } from "@/lib/time";
import { randomId } from "@/lib/password";

/**
 * 提交标注：
 * 1. 后端重新校验片段（不信任前端）
 * 2. 在同一事务里写入正式提交版本 + 锁定任务
 * 3. 有效时长与提交日期一起落库，统计只读当前有效版本
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const task = getTask(user, id);
    if (!task) throw new ApiError(404, "任务不存在或无权访问", "NOT_FOUND");
    if (task.status === "SUBMITTED") throw new ApiError(409, "任务已经提交过了", "CONFLICT");
    if (task.assignee_id !== user.id) throw new ApiError(403, "只有任务领取人可以提交", "FORBIDDEN");

    const body = await readJson<{ segments?: InputSegment[] }>(req).catch(() => ({ segments: undefined }));

    const db = getDb();
    // 优先使用请求体中的片段（前端最后一次编辑），否则使用已保存的草稿
    const raw =
      body.segments ??
      (db
        .prepare("SELECT start_time AS start, end_time AS end, label FROM segments WHERE task_id = ? ORDER BY start_time")
        .all(id) as InputSegment[]);

    const segments = normalizeSegments(raw, task.video_duration);
    if (segments.length === 0) {
      throw new ApiError(422, "至少标注一个时间段后才能提交", "EMPTY_SUBMISSION");
    }

    const total = totalDuration(segments);
    const now = nowIso();
    const day = bizDate(now);

    const result = db.transaction(() => {
      const row = db
        .prepare("SELECT status, assignee_id, tenant_id FROM tasks WHERE id = ?")
        .get(id) as { status: string; assignee_id: string | null; tenant_id: string };
      if (row.status !== "IN_PROGRESS" || row.assignee_id !== user.id) {
        throw new ApiError(409, "任务状态已变更，请刷新后重试", "CONFLICT");
      }

      // 覆盖草稿为最终片段
      db.prepare("DELETE FROM segments WHERE task_id = ?").run(id);
      const insertSeg = db.prepare(
        "INSERT INTO segments (id, task_id, start_time, end_time, label, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
      );
      for (const s of segments) insertSeg.run(randomId("seg"), id, s.start, s.end, s.label, now, now);

      const version =
        ((db.prepare("SELECT COALESCE(MAX(version), 0) AS v FROM submissions WHERE task_id = ?").get(id) as {
          v: number;
        }).v ?? 0) + 1;

      // 旧的“当前版本”作废，保证统计不重复计数
      db.prepare("UPDATE submissions SET is_current = 0 WHERE task_id = ?").run(id);

      const submissionId = randomId("sub");
      db.prepare(
        `INSERT INTO submissions (id, task_id, version, submitted_by, submitted_at, submitted_date,
           total_duration, segment_count, segments_json, is_current, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,1,?)`,
      ).run(
        submissionId,
        id,
        version,
        user.id,
        now,
        day,
        total,
        segments.length,
        JSON.stringify(segments.map((s) => ({ start: s.start, end: s.end, label: s.label }))),
        now,
      );

      db.prepare(
        `UPDATE tasks SET status = 'SUBMITTED', review_status = 'PENDING', reviewed_by = NULL,
           reviewed_at = NULL, review_comment = NULL, submitted_at = ?, submitted_date = ?,
           revision = ?, updated_at = ? WHERE id = ?`,
      ).run(now, day, version, now, id);

      db.prepare(
        "INSERT INTO audit_logs (id, tenant_id, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)",
      ).run(
        randomId("log"),
        row.tenant_id,
        user.id,
        "TASK_SUBMITTED",
        "task",
        id,
        JSON.stringify({ total_duration: total, segment_count: segments.length, version }),
        now,
      );

      return { submissionId, version };
    }).immediate();

    return json({
      ok: true,
      submittedAt: now,
      submittedDate: day,
      totalDuration: total,
      segmentCount: segments.length,
      version: result.version,
    });
  } catch (error) {
    return fail(error);
  }
}
