"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { useToast } from "./toast";
import { Button } from "./ui";

export function ClaimButton({ taskId, small }: { taskId: string; small?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function claim() {
    setLoading(true);
    try {
      await api(`/api/tasks/${taskId}/claim`, { method: "POST" });
      toast.push({ kind: "success", message: "任务已领取", detail: "开始标注吧" });
      router.push(`/annotate/${taskId}`);
    } catch (err) {
      toast.push({
        kind: "error",
        message: err instanceof ApiClientError ? err.message : "领取失败",
      });
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <Button size={small ? "sm" : "default"} onClick={claim} disabled={loading}>
      {loading && <span className="spinner" />}
      {loading ? "领取中…" : "领取任务"}
    </Button>
  );
}
