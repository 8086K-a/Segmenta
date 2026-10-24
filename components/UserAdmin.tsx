"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { Button, Field, Input, Modal, Select } from "./ui";
import { useToast } from "./toast";
import { IconAlert, IconPlus } from "./icons";

export function CreateUserButton({
  tenants,
  defaultTenantId,
  isSuperAdmin,
}: {
  tenants: { id: string; name: string }[];
  defaultTenantId: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ANNOTATOR", tenantId: defaultTenantId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
      toast.push({ kind: "success", message: "成员已创建", detail: `${form.name} 可以用邮箱登录了` });
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "ANNOTATOR", tenantId: defaultTenantId });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <IconPlus size={14} />
        添加成员
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="添加团队成员"
        desc="标注员只能看到所属租户的任务；管理员可发布任务与查看统计。"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <span className="spinner" />}
              创建账号
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="姓名">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="陈安娜" />
            </Field>
            <Field label="角色">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="ANNOTATOR">标注员</option>
                <option value="ADMIN">租户管理员</option>
                {isSuperAdmin && <option value="SUPER_ADMIN">平台管理员</option>}
              </Select>
            </Field>
          </div>

          <Field label="邮箱">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@company.com"
            />
          </Field>

          <Field label="初始密码" hint="至少 8 位，请通过安全渠道告知成员。">
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="至少 8 位"
            />
          </Field>

          {tenants.length > 1 && (
            <Field label="所属租户">
              <Select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
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

export function UserStatusButton({
  userId,
  status,
  disabled,
}: {
  userId: string;
  status: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await api(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: status === "ACTIVE" ? "DISABLED" : "ACTIVE" }),
      });
      toast.push({ kind: "success", message: status === "ACTIVE" ? "成员已停用" : "成员已启用" });
      router.refresh();
    } catch (err) {
      toast.push({ kind: "error", message: err instanceof ApiClientError ? err.message : "操作失败" });
    } finally {
      setBusy(false);
    }
  }

  if (disabled) return <span className="text-xs text-muted-foreground/50">—</span>;

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {busy ? "处理中…" : status === "ACTIVE" ? "停用" : "启用"}
    </button>
  );
}
