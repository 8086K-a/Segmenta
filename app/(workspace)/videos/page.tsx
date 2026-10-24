import { redirect } from "next/navigation";
import { canAccessTenant, getSessionUser, tenantScope } from "@/lib/auth";
import { listTenants, listVideos } from "@/lib/queries";
import { formatClock, formatDateTime } from "@/lib/time";
import { EmptyState, PageHeader } from "@/components/ui";
import { UploadVideoButton } from "@/components/UploadVideoButton";
import { DeleteVideoButton } from "@/components/VideoActions";
import { TenantSelect } from "@/components/TenantSelect";
import { VideoThumb } from "@/components/VideoThumb";
import { IconFilm } from "@/components/icons";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "ANNOTATOR") redirect("/my-tasks");

  const sp = await searchParams;
  const tenantId = sp.tenantId && canAccessTenant(user, sp.tenantId) ? sp.tenantId : null;
  const videos = listVideos(user, tenantId);
  const tenants = listTenants(user);
  const multi = tenantScope(user).length > 1;

  return (
    <>
      <PageHeader
        title="视频库"
        subtitle="视频文件保存在服务端存储，数据库只记录元数据。播放请求按 Range 分片并校验租户权限。"
        meta={<span className="text-xs text-muted-foreground">{videos.length} 个视频</span>}
        actions={
          <>
            {multi && <TenantSelect tenants={tenants.map((t) => ({ id: t.id, name: t.name }))} value={tenantId} />}
            <UploadVideoButton
              tenants={tenants.map((t) => ({ id: t.id, name: t.name }))}
              defaultTenantId={tenantId ?? user.tenantId}
            />
          </>
        }
      />

      {videos.length === 0 ? (
        <div className="mt-6 rounded-lg bg-card ring-1 ring-foreground/10">
          <EmptyState
            icon={<IconFilm size={18} />}
            title="视频库还是空的"
            desc="上传一段机器人示教视频，然后就可以创建标注任务了"
          />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((v) => (
            <div key={v.id} className="group flex flex-col">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                <VideoThumb videoId={v.id} />
                <div className="absolute bottom-2 right-2 rounded-sm bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white tnum">
                  {v.duration ? formatClock(v.duration) : "—"}
                </div>
                <div className="absolute right-2 top-2">
                  <DeleteVideoButton videoId={v.id} filename={v.filename} />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 pt-3">
                <h3 className="truncate text-sm font-medium" title={v.filename}>
                  {v.filename}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="tnum">{formatBytes(v.size)}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{v.task_count} 个任务</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="tnum">{formatDateTime(v.created_at)}</span>
                </div>
                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="font-mono text-[10px] text-muted-foreground/60">{v.storage_key}</span>
                  <span className="text-[10.5px] text-muted-foreground/70">{v.tenant_name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-[11px] text-muted-foreground/70">
        已被任务引用的视频无法删除；删除任务后才能移除源文件。
      </p>
    </>
  );
}
