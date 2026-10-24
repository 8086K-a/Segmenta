"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError, probeVideoDuration, uploadVideo } from "@/lib/client";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";
import { useToast } from "./toast";
import { IconPlus, IconUpload, IconAlert } from "./icons";

type Video = { id: string; filename: string; duration: number | null; size: number; tenant_id: string };
type Member = { id: string; name: string; role: string; tenant_id: string };

export function CreateTaskButton({
  tenants,
  defaultTenantId,
}: {
  tenants: { id: string; name: string }[];
  defaultTenantId: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const [tenantId, setTenantId] = useState(defaultTenantId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoId, setVideoId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (tid: string) => {
    setLoading(true);
    try {
      const [v, u] = await Promise.all([
        api<{ videos: Video[] }>(`/api/videos?tenantId=${tid}`),
        api<{ users: Member[] }>(`/api/admin/users?tenantId=${tid}`),
      ]);
      setVideos(v.videos);
      setMembers(u.users.filter((m) => m.role === "ANNOTATOR"));
      setVideoId((cur) => (v.videos.some((x) => x.id === cur) ? cur : (v.videos[0]?.id ?? "")));
    } catch {
      /* 静默失败，用户可重试 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load(tenantId);
  }, [open, tenantId, load]);

  async function handleUpload(file: File) {
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const [{ video }, duration] = await Promise.all([
        uploadVideo(file, tenantId, setProgress),
        probeVideoDuration(file),
      ]);
      await api(`/api/videos/${video.id}`, { method: "PATCH", body: JSON.stringify({ duration }) });
      await load(tenantId);
      setVideoId(video.id);
      toast.push({ kind: "success", message: "视频已上传", detail: `${video.filename} · ${duration.toFixed(1)} 秒` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    if (!title.trim()) return setError("请填写任务名称");
    if (!videoId) return setError("请选择一个视频");
    setSaving(true);
    setError(null);
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title, description, videoId, tenantId, assigneeId: assigneeId || null }),
      });
      toast.push({ kind: "success", message: "任务已创建" });
      setOpen(false);
      setTitle("");
      setDescription("");
      setAssigneeId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <IconPlus size={14} />
        新建任务
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新建标注任务"
        desc="选择视频与租户，创建后标注员可在任务大厅领取。"
        width={540}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={submit} disabled={saving || uploading}>
              {saving && <span className="spinner" />}
              {saving ? "创建中…" : "创建任务"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          {tenants.length > 1 && (
            <Field label="所属租户">
              <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="任务名称">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：咖啡机操作：取杯与压杆"
              maxLength={120}
            />
          </Field>

          <Field label="标注说明" hint="告诉标注员哪些动作需要保留、如何切分。">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="标出机械臂抓杯、移动、压杆的完整动作区间，空转不计入。"
              maxLength={2000}
            />
          </Field>

          <Field label="视频">
            <div className="flex gap-2">
              <Select value={videoId} onChange={(e) => setVideoId(e.target.value)} disabled={loading || uploading}>
                {videos.length === 0 && <option value="">该租户还没有视频</option>}
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.filename} {v.duration ? `· ${v.duration.toFixed(0)}s` : ""}
                  </option>
                ))}
              </Select>
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="shrink-0">
                <IconUpload size={13} />
                {uploading ? `${progress}%` : "上传"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
            </div>
            {uploading && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-accent">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </Field>

          <Field label="指派给（可选）" hint="不指派则进入任务大厅，由标注员自行领取。">
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">不指派 · 进入任务大厅</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>

          {error && (
            <div className="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
              <IconAlert size={13} className="mt-px shrink-0" />
              {error}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
