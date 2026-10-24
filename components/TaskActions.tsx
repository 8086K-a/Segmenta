"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { Button, Field, Modal, Textarea } from "./ui";
import { useToast } from "./toast";
import { IconCheck, IconTrash, IconX } from "./icons";

export function TaskActions({
  taskId,
  status,
  reviewStatus,
}: {
  taskId: string;
  status: string;
  reviewStatus: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReview = status === "SUBMITTED" && reviewStatus === "PENDING";

  async function review(decision: "APPROVE" | "REJECT") {
    if (decision === "REJECT" && !comment.trim()) {
      setError("请填写退回原因");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tasks/${taskId}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, comment }),
      });
      toast.push({
        kind: "success",
        message: decision === "APPROVE" ? "已审核通过" : "已退回给标注员",
        detail: decision === "APPROVE" ? "工时保留在提交日期" : "该版本作废，修改后需重新提交",
      });
      setApproveOpen(false);
      setRejectOpen(false);
      setComment("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tasks/${taskId}`, { method: "DELETE" });
      toast.push({ kind: "success", message: "任务已删除" });
      router.push("/tasks");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "删除失败");
      setBusy(false);
    }
  }

  return (
    <>
      {canReview && (
        <>
          <Button variant="outline" onClick={() => setRejectOpen(true)}>
            <IconX size={13} />
            退回
          </Button>
          <Button onClick={() => setApproveOpen(true)}>
            <IconCheck size={13} />
            审核通过
          </Button>
        </>
      )}
      <Button variant="destructive-outline" size="icon" onClick={() => setDeleteOpen(true)} title="删除任务">
        <IconTrash size={13} />
      </Button>

      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="审核通过？"
        desc="通过后该任务进入终态，标注员不能再修改，工时保留在提交当天。"
        footer={
          <>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button onClick={() => review("APPROVE")} disabled={busy}>
              {busy && <span className="spinner" />}
              确认通过
            </Button>
          </>
        }
      >
        <Field label="审核意见（可选）">
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="例如：切分准确，可以入库"
            maxLength={500}
          />
        </Field>
        {error && (
          <div className="mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-[0.6875rem] text-destructive">
            {error}
          </div>
        )}
      </Modal>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="退回重新标注？"
        desc="退回后该提交版本作废、从工时统计中移除，任务回到进行中，标注员可修改后重新提交。"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => review("REJECT")} disabled={busy}>
              {busy && <span className="spinner" />}
              确认退回
            </Button>
          </>
        }
      >
        <Field label="退回原因" hint="标注员会在工作台里看到这条说明。">
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="例如：第 2 段把空转也标进去了，请重新切分"
            maxLength={500}
          />
        </Field>
        {error && (
          <div className="mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-[0.6875rem] text-destructive">
            {error}
          </div>
        )}
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="删除任务？"
        desc="任务及其片段、提交记录将被永久删除，且会从工作量统计中移除。"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy && <span className="spinner" />}
              确认删除
            </Button>
          </>
        }
      >
        {error && (
          <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-[0.6875rem] text-destructive">
            {error}
          </div>
        )}
      </Modal>
    </>
  );
}
