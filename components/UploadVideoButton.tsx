"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, probeVideoDuration, uploadVideo } from "@/lib/client";
import { Button, Field, Modal, Select } from "./ui";
import { useToast } from "./toast";
import { IconAlert, IconUpload } from "./icons";

export function UploadVideoButton({
  tenants,
  defaultTenantId,
}: {
  tenants: { id: string; name: string }[];
  defaultTenantId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [tenantId, setTenantId] = useState(defaultTenantId);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!file) return setError("请选择视频文件");
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const [{ video }, duration] = await Promise.all([
        uploadVideo(file, tenantId, setProgress),
        probeVideoDuration(file),
      ]);
      await api(`/api/videos/${video.id}`, { method: "PATCH", body: JSON.stringify({ duration }) });
      toast.push({ kind: "success", message: "视频已上传", detail: `${video.filename} · ${duration.toFixed(1)} 秒` });
      setOpen(false);
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <IconUpload size={14} />
        上传视频
      </Button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="上传视频"
        desc="支持 mp4 / webm / mov，单个文件不超过 2GB。上传后自动读取时长。"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button onClick={start} disabled={busy || !file}>
              {busy && <span className="spinner" />}
              {busy ? `上传中 ${progress}%` : "开始上传"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          {tenants.length > 1 && (
            <Field label="所属租户">
              <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)} disabled={busy}>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-accent/20 px-4 py-8 transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:cursor-not-allowed"
          >
            <IconUpload size={20} className="text-muted-foreground" />
            <span className="mt-2 text-sm font-medium">{file ? file.name : "选择视频文件"}</span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "点击浏览本地文件"}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />

          {busy && (
            <div>
              <div className="h-1 overflow-hidden rounded-full bg-accent">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">正在上传 {progress}%…</div>
            </div>
          )}

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
