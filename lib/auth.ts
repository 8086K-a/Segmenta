import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { DATA_DIR, getDb } from "./db";
import type { SessionUser } from "./types";

export type { SessionUser };

const COOKIE_NAME = "sg_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 天

let cachedSecret: string | null = null;

function secret(): string {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET) {
    cachedSecret = process.env.SESSION_SECRET;
    return cachedSecret;
  }
  const file = path.join(DATA_DIR, ".session-secret");
  try {
    cachedSecret = fs.readFileSync(file, "utf8").trim();
  } catch {
    cachedSecret = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 });
  const body = Buffer.from(payload).toString("base64url");
  return `${body}.${sign(body)}`;
}

function readToken(token: string): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!uid || typeof exp !== "number" || exp < Date.now()) return null;
    return uid;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** 从 cookie 解析当前用户；用户被禁用或删除时返回 null */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const uid = readToken(token);
  if (!uid) return null;

  const row = getDb()
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.tenant_id,
              t.name AS tenant_name, t.slug AS tenant_slug, t.status AS tenant_status
         FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE u.id = ?`,
    )
    .get(uid) as
    | {
        id: string;
        name: string;
        email: string;
        role: SessionUser["role"];
        status: string;
        tenant_id: string;
        tenant_name: string;
        tenant_slug: string;
        tenant_status: string;
      }
    | undefined;

  if (!row || row.status !== "ACTIVE" || row.tenant_status !== "ACTIVE") return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    tenantSlug: row.tenant_slug,
  };
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN";
}

/** 当前用户可访问的租户范围：租户管理员只限本租户，平台管理员可跨租户 */
export function tenantScope(user: SessionUser): string[] {
  if (user.role === "SUPER_ADMIN") {
    return (
      getDb().prepare("SELECT id FROM tenants ORDER BY created_at").all() as { id: string }[]
    ).map((r) => r.id);
  }
  return [user.tenantId];
}

export function canAccessTenant(user: SessionUser, tenantId: string): boolean {
  return user.role === "SUPER_ADMIN" || user.tenantId === tenantId;
}
