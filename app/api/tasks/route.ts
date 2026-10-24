import { getDb } from "@/lib/db";
import { canAccessTenant, isAdmin, tenantScope } from "@/lib/auth";
import { ApiError, fail, json, readJson, requireAdmin, requireUser, str } from "@/lib/api";
import { listTasks } from "@/lib/queries";
import { nowIso } from "@/lib/time";
import { randomId } from "@/lib/password";
import type { TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const scopeParam = url.searchParams.get("scope");
    const scope: "hall" | "mine" | "all" =
      scopeParam === "hall" || scopeParam === "mine" ? scopeParam : user.role === "ANNOTATOR" ? "mine" : "all";

    const tasks = listTasks(user, {
      scope,
      status: (url.searchParams.get("status") as TaskStatus | "ALL") || "ALL",
      tenantId: url.searchParams.get("tenantId"),
      assigneeId: url.searchParams.get("assigneeId"),
      q: url.searchParams.get("q") || undefined,
    });
    return json({ tasks });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const body = await readJson<{
      title?: string;
      description?: string;
      videoId?: string;
      tenantId?: string;
      assigneeId?: string | null;
    }>(req);

    const title = str(body.title, "任务名称", 120);
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
    const videoId = str(body.videoId, "视频", 64);
    const tenantId = body.tenantId || user.tenantId;
    if (!canAccessTenant(user, tenantId)) throw new ApiError(403, "无权在该租户下创建任务", "FORBIDDEN");

    const db = getDb();
    const video = db.prepare("SELECT id, tenant_id FROM videos WHERE id = ?").get(videoId) as
      | { id: string; tenant_id: string }
      | undefined;
    if (!video) throw new ApiError(404, "视频不存在", "NOT_FOUND");
    if (video.tenant_id !== tenantId) throw new ApiError(422, "视频不属于所选租户", "TENANT_MISMATCH");

    let assigneeId: string | null = null;
    if (body.assigneeId) {
      const assignee = db
        .prepare("SELECT id, role, tenant_id, status FROM users WHERE id = ?")
        .get(body.assigneeId) as { id: string; role: string; tenant_id: string; status: string } | undefined;
      if (!assignee || assignee.tenant_id !== tenantId || assignee.role !== "ANNOTATOR") {
        throw new ApiError(422, "指定的标注员不属于该租户", "INVALID_ASSIGNEE");
      }
      if (assignee.status !== "ACTIVE") throw new ApiError(422, "该标注员已停用", "INVALID_ASSIGNEE");
      assigneeId = assignee.id;
    }

    const id = randomId("task");
    const now = nowIso();
    db.prepare(
      `INSERT INTO tasks (id, tenant_id, video_id, title, description, status, assignee_id, created_by,
         created_at, updated_at, claimed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      tenantId,
      videoId,
      title,
      description || null,
      assigneeId ? "IN_PROGRESS" : "AVAILABLE",
      assigneeId,
      user.id,
      now,
      now,
      assigneeId ? now : null,
    );

    db.prepare(
      "INSERT INTO audit_logs (id, tenant_id, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run(randomId("log"), tenantId, user.id, "TASK_CREATED", "task", id, JSON.stringify({ title }), now);

    const task = listTasks(user, { scope: "all", tenantId }).find((t) => t.id === id);
    return json({ task }, 201);
  } catch (error) {
    return fail(error);
  }
}

/** 供页面使用的租户范围检查 */
export async function HEAD() {
  const user = await requireUser();
  return json({ tenants: isAdmin(user) ? tenantScope(user) : [user.tenantId] });
}
