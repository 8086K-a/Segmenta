"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { Button, Modal } from "./ui";
import { useToast } from "./toast";
import { IconTrash } from "./icons";

export function DeleteVideoButton({ videoId, filename }: { videoId: string; filename: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/videos/${videoId}`, { method: "DELETE" });
      toast.push({ kind: "success", message: "视频已删除" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex size-7 cursor-pointer items-center justify-center rounded-sm bg-black/60 text-white/80 opacity-0 backdrop-blur-sm transition hover:bg-destructive hover:text-white group-hover:opacity-100"
        title="删除视频"
        aria-label="删除视频"
      >
        <IconTrash size={13} />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="删除视频？"
        desc={filename}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy && <span className="spinner" />}
              确认删除
            </Button>
          </>
        }
      >
        <div className="rounded-sm border border-border bg-accent/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          文件会从存储中移除。已被任务引用的视频无法删除，需要先删除相关任务。
        </div>
        {error && (
          <div className="mt-2 rounded-sm border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </Modal>
    </>
  );
}
