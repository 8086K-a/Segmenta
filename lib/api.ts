import { NextResponse } from "next/server";
import { getSessionUser, isAdmin, type SessionUser } from "./auth";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = "ERROR", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json({ error: "服务器内部错误", code: "INTERNAL" }, { status: 500 });
}

/** 在 route handler 中获取已登录用户，未登录抛 401 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "请先登录", "UNAUTHENTICATED");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user)) throw new ApiError(403, "需要管理员权限", "FORBIDDEN");
  return user;
}

export async function requireAnnotator(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ANNOTATOR") throw new ApiError(403, "该操作仅限标注员", "FORBIDDEN");
  return user;
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "请求体不是合法 JSON", "BAD_JSON");
  }
}

export function str(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(422, `${field}不能为空`, "VALIDATION");
  }
  const v = value.trim();
  if (v.length > max) throw new ApiError(422, `${field}长度不能超过 ${max} 字`, "VALIDATION");
  return v;
}
