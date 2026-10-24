import fs from "node:fs";
import path from "node:path";
import { STORAGE_DIR, getDb } from "@/lib/db";
import { canAccessTenant } from "@/lib/auth";
import { ApiError, fail, json, readJson, requireAdmin, requireUser } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const video = getDb().prepare("SELECT * FROM videos WHERE id = ?").get(id) as
      | { id: string; tenant_id: string; duration: number | null }
      | undefined;
    if (!video || !canAccessTenant(user, video.tenant_id)) {
      throw new ApiError(404, "视频不存在或无权访问", "NOT_FOUND");
    }
    return json({ video });
  } catch (error) {
    return fail(error);
  }
}

/** 上传完成后由前端读取媒体元数据回填时长（服务端不依赖 ffprobe） */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const video = getDb().prepare("SELECT id, tenant_id FROM videos WHERE id = ?").get(id) as
      | { id: string; tenant_id: string }
      | undefined;
    if (!video || !canAccessTenant(admin, video.tenant_id)) {
      throw new ApiError(404, "视频不存在或无权访问", "NOT_FOUND");
    }

    const body = await readJson<{ duration?: number }>(req);
    const duration = Number(body.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 86400) {
      throw new ApiError(422, "视频时长不合法", "VALIDATION");
    }

    getDb()
      .prepare("UPDATE videos SET duration = ? WHERE id = ?")
      .run(Math.round(duration * 1000) / 1000, id);

    return json({ ok: true, duration });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const db = getDb();
    const video = db.prepare("SELECT id, tenant_id, storage_key FROM videos WHERE id = ?").get(id) as
      | { id: string; tenant_id: string; storage_key: string }
      | undefined;
    if (!video || !canAccessTenant(admin, video.tenant_id)) {
      throw new ApiError(404, "视频不存在或无权访问", "NOT_FOUND");
    }

    const used = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE video_id = ?").get(id) as { n: number };
    if (used.n > 0) throw new ApiError(409, `该视频已被 ${used.n} 个任务引用，无法删除`, "IN_USE");

    db.prepare("DELETE FROM videos WHERE id = ?").run(id);
    const file = path.join(STORAGE_DIR, path.basename(video.storage_key));
    fs.rm(file, { force: true }, () => {});

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
