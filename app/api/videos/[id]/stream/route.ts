import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { STORAGE_DIR, getDb } from "@/lib/db";
import { canAccessTenant } from "@/lib/auth";
import { ApiError, fail, requireUser } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 带 Range 支持的视频流；每次请求都校验登录态与租户归属 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const video = getDb()
      .prepare("SELECT id, tenant_id, storage_key, mime_type FROM videos WHERE id = ?")
      .get(id) as { id: string; tenant_id: string; storage_key: string; mime_type: string } | undefined;

    if (!video || !canAccessTenant(user, video.tenant_id)) {
      throw new ApiError(404, "视频不存在或无权访问", "NOT_FOUND");
    }

    const filePath = path.join(STORAGE_DIR, path.basename(video.storage_key));
    if (!fs.existsSync(filePath)) throw new ApiError(410, "视频文件已丢失，请联系管理员", "GONE");

    const stat = fs.statSync(filePath);
    const range = req.headers.get("range");
    const baseHeaders: Record<string, string> = {
      "Content-Type": video.mime_type || "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    };

    if (!range) {
      return new Response(Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream, {
        status: 200,
        headers: { ...baseHeaders, "Content-Length": String(stat.size) },
      });
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) throw new ApiError(416, "Range 格式不正确", "RANGE_INVALID");

    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : stat.size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }
    end = Math.min(end, stat.size - 1);

    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  } catch (error) {
    return fail(error);
  }
}
