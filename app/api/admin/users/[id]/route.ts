import { getDb } from "@/lib/db";
import { ApiError, fail, json, readJson, requireAdmin } from "@/lib/api";
import { hashPassword, randomId } from "@/lib/password";
import { nowIso } from "@/lib/time";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const db = getDb();
    const target = db.prepare("SELECT id, tenant_id, role FROM users WHERE id = ?").get(id) as
      | { id: string; tenant_id: string; role: string }
      | undefined;
    if (!target) throw new ApiError(404, "成员不存在", "NOT_FOUND");
    if (target.tenant_id !== admin.tenantId && admin.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "无权操作其他租户的成员", "FORBIDDEN");
    }
    if (target.id === admin.id) throw new ApiError(422, "不能修改自己的账号状态", "SELF_UPDATE");

    const body = await readJson<{ status?: string; password?: string; name?: string }>(req);

    if (body.status) {
      if (!["ACTIVE", "DISABLED"].includes(body.status)) throw new ApiError(422, "状态不合法", "VALIDATION");
      db.prepare("UPDATE users SET status = ? WHERE id = ?").run(body.status, id);
    }
    if (body.password) {
      if (body.password.length < 8) throw new ApiError(422, "密码至少 8 位", "VALIDATION");
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(body.password), id);
    }
    if (body.name) {
      db.prepare("UPDATE users SET name = ? WHERE id = ?").run(body.name.trim().slice(0, 40), id);
    }

    db.prepare(
      "INSERT INTO audit_logs (id, tenant_id, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run(
      randomId("log"),
      target.tenant_id,
      admin.id,
      "USER_UPDATED",
      "user",
      id,
      JSON.stringify({ status: body.status ?? null, name: body.name ?? null }),
      nowIso(),
    );

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
