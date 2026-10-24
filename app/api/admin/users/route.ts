import { getDb } from "@/lib/db";
import { canAccessTenant, tenantScope } from "@/lib/auth";
import { ApiError, fail, json, readJson, requireAdmin, str } from "@/lib/api";
import { hashPassword, randomId } from "@/lib/password";
import { listUsers } from "@/lib/queries";
import { nowIso } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    const url = new URL(req.url);
    return json({ users: listUsers(admin, url.searchParams.get("tenantId")) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await readJson<{
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      tenantId?: string;
    }>(req);

    const name = str(body.name, "姓名", 40);
    const email = str(body.email, "邮箱", 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(422, "邮箱格式不正确", "VALIDATION");
    const password = body.password ?? "";
    if (password.length < 8) throw new ApiError(422, "密码至少 8 位", "VALIDATION");

    const role = body.role === "ADMIN" ? "ADMIN" : body.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ANNOTATOR";
    if (role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "只有平台管理员可以创建平台管理员", "FORBIDDEN");
    }

    const tenantId = body.tenantId || admin.tenantId;
    if (!canAccessTenant(admin, tenantId)) throw new ApiError(403, "无权在该租户下创建成员", "FORBIDDEN");

    const db = getDb();
    const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (exists) throw new ApiError(409, "该邮箱已被使用", "EMAIL_TAKEN");

    const id = randomId("u");
    db.prepare(
      `INSERT INTO users (id, tenant_id, email, name, password_hash, role, status, created_at)
       VALUES (?,?,?,?,?,?,'ACTIVE',?)`,
    ).run(id, tenantId, email, name, hashPassword(password), role, nowIso());

    db.prepare(
      "INSERT INTO audit_logs (id, tenant_id, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run(randomId("log"), tenantId, admin.id, "USER_CREATED", "user", id, JSON.stringify({ role }), nowIso());

    return json({ user: listUsers(admin, tenantId).find((u) => u.id === id) }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function HEAD() {
  const admin = await requireAdmin();
  return json({ tenants: tenantScope(admin) });
}
