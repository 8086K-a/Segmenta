import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/auth";
import { ApiError, fail, json, readJson } from "@/lib/api";
import { nowIso } from "@/lib/time";
import { randomId } from "@/lib/password";

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();
const WINDOW = 60_000;
const LIMIT = 8;

function checkRate(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW });
    return;
  }
  rec.count += 1;
  if (rec.count > LIMIT) {
    throw new ApiError(429, "尝试次数过多，请稍后再试", "RATE_LIMITED");
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson<{ email?: string; password?: string }>(req);
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) throw new ApiError(422, "请输入邮箱和密码", "VALIDATION");

    checkRate(email);

    const user = getDb()
      .prepare(
        `SELECT u.id, u.password_hash, u.role, u.status, u.name, u.tenant_id, t.status AS tenant_status
           FROM users u JOIN tenants t ON t.id = u.tenant_id
          WHERE u.email = ?`,
      )
      .get(email) as
      | {
          id: string;
          password_hash: string;
          role: string;
          status: string;
          name: string;
          tenant_id: string;
          tenant_status: string;
        }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new ApiError(401, "邮箱或密码不正确", "BAD_CREDENTIALS");
    }
    if (user.status !== "ACTIVE") throw new ApiError(403, "账号已被停用，请联系管理员", "DISABLED");
    if (user.tenant_status !== "ACTIVE") throw new ApiError(403, "所属租户已停用", "TENANT_DISABLED");

    await setSessionCookie(user.id);
    attempts.delete(email);

    getDb()
      .prepare(
        "INSERT INTO audit_logs (id, tenant_id, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)",
      )
      .run(randomId("log"), user.tenant_id, user.id, "LOGIN", "user", user.id, null, nowIso());

    return json({ ok: true, name: user.name, role: user.role });
  } catch (error) {
    return fail(error);
  }
}
