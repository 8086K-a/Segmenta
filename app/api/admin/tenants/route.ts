import { getDb } from "@/lib/db";
import { ApiError, fail, json, readJson, requireAdmin, str } from "@/lib/api";
import { randomId } from "@/lib/password";
import { listTenants } from "@/lib/queries";
import { nowIso } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    return json({ tenants: listTenants(admin) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (admin.role !== "SUPER_ADMIN") throw new ApiError(403, "只有平台管理员可以创建租户", "FORBIDDEN");
    const body = await readJson<{ name?: string; slug?: string }>(req);
    const name = str(body.name, "租户名称", 60);
    const slug = (body.slug || `t-${Date.now().toString(36)}`).toLowerCase().replace(/[^a-z0-9-]/g, "-");

    const db = getDb();
    if (db.prepare("SELECT id FROM tenants WHERE slug = ?").get(slug)) {
      throw new ApiError(409, "该标识已存在", "SLUG_TAKEN");
    }

    const id = randomId("t");
    db.prepare("INSERT INTO tenants (id, name, slug, status, created_at) VALUES (?,?,?,'ACTIVE',?)").run(
      id,
      name,
      slug,
      nowIso(),
    );
    return json({ tenant: listTenants(admin).find((t) => t.id === id) }, 201);
  } catch (error) {
    return fail(error);
  }
}
