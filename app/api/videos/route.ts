import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { STORAGE_DIR, getDb } from "@/lib/db";
import { canAccessTenant } from "@/lib/auth";
import { ApiError, fail, json, requireAdmin, requireUser } from "@/lib/api";
import { listVideos } from "@/lib/queries";
import { nowIso } from "@/lib/time";
import { randomId } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const ALLOWED = new Set([".mp4", ".webm", ".mov", ".m4v", ".ogv"]);

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    return json({ videos: listVideos(user, url.searchParams.get("tenantId")) });
  } catch (error) {
    return fail(error);
  }
}

/**
 * 原始字节流上传（application/octet-stream），避免 multipart 把 500MB 视频读进内存。
 * 文件名与租户通过 query 传递。
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const url = new URL(req.url);
    const filename = (url.searchParams.get("filename") || "").trim();
    const tenantId = url.searchParams.get("tenantId") || admin.tenantId;

    if (!filename) throw new ApiError(422, "缺少文件名", "VALIDATION");
    if (!canAccessTenant(admin, tenantId)) throw new ApiError(403, "无权上传到该租户", "FORBIDDEN");
    if (!req.body) throw new ApiError(400, "请求体为空", "BAD_REQUEST");

    const ext = path.extname(filename).toLowerCase() || ".mp4";
    if (!ALLOWED.has(ext)) {
      throw new ApiError(422, `不支持的视频格式 ${ext}，请上传 mp4 / webm / mov`, "UNSUPPORTED_TYPE");
    }

    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) throw new ApiError(413, "视频不能超过 2GB", "TOO_LARGE");

    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    const storageKey = `${randomId("vid")}${ext}`;
    const target = path.join(STORAGE_DIR, storageKey);

    let written = 0;
    const source = Readable.fromWeb(req.body as never);
    source.on("data", (chunk: Buffer) => {
      written += chunk.length;
      if (written > MAX_BYTES) source.destroy(new Error("TOO_LARGE"));
    });

    try {
      await pipeline(source, fs.createWriteStream(target));
    } catch (err) {
      fs.rm(target, { force: true }, () => {});
      if (err instanceof Error && err.message === "TOO_LARGE") {
        throw new ApiError(413, "视频不能超过 2GB", "TOO_LARGE");
      }
      throw err;
    }

    const id = randomId("video");
    getDb()
      .prepare(
        `INSERT INTO videos (id, tenant_id, filename, storage_key, mime_type, size, duration, created_at, uploaded_by)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        tenantId,
        path.basename(filename),
        storageKey,
        "video/mp4",
        written,
        null,
        nowIso(),
        admin.id,
      );

    return json({ video: { id, filename: path.basename(filename), size: written, storageKey } }, 201);
  } catch (error) {
    return fail(error);
  }
}
