import { redirect } from "next/navigation";
import { getSessionUser, tenantScope } from "@/lib/auth";
import { listTenants, listUsers } from "@/lib/queries";
import { formatHuman } from "@/lib/time";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui";
import { CreateUserButton, UserStatusButton } from "@/components/UserAdmin";
import { IconShield } from "@/components/icons";
import { ROLE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "ANNOTATOR") redirect("/my-tasks");

  const tenants = listTenants(user);
  const members = listUsers(user);
  const tenantOptions = tenants.map((t) => ({ id: t.id, name: t.name }));
  const multi = tenantScope(user).length > 1;

  return (
    <>
      <PageHeader
        title="团队与租户"
        subtitle="成员按租户划分，标注员只能看到本租户的任务。租户隔离在后端每个接口强制执行。"
        meta={<span className="text-xs text-muted-foreground">{members.length} 名成员</span>}
        actions={
          <CreateUserButton
            tenants={tenantOptions}
            defaultTenantId={user.tenantId}
            isSuperAdmin={user.role === "SUPER_ADMIN"}
          />
        }
      />

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tenants.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-md border border-border bg-accent/50 text-xs font-medium">
                  {t.name.slice(0, 1)}
                </span>
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{t.slug}</div>
                </div>
              </div>
              <Badge tone="success">正常</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
              <div>
                <div className="text-[10.5px] text-muted-foreground">成员</div>
                <div className="tnum mt-0.5 text-sm font-medium">{t.user_count}</div>
              </div>
              <div>
                <div className="text-[10.5px] text-muted-foreground">任务</div>
                <div className="tnum mt-0.5 text-sm font-medium">{t.task_count}</div>
              </div>
              <div>
                <div className="text-[10.5px] text-muted-foreground">累计有效</div>
                <div className="mt-0.5 text-xs font-medium">{formatHuman(t.total_seconds)}</div>
              </div>
            </div>
          </Card>
        ))}

        <Card className="flex items-start gap-3 border-dashed p-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-accent/40 text-muted-foreground">
            <IconShield size={15} />
          </span>
          <div>
            <div className="text-sm font-medium">数据隔离策略</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              租户身份来自登录会话，不接受前端传参。任务、视频、片段的每次读写都会校验租户归属，跨租户访问统一返回 404。
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-3 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-medium">成员列表</div>
          <span className="text-xs text-muted-foreground">共 {members.length} 人</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>成员</th>
                <th>角色</th>
                {multi && <th>租户</th>}
                <th className="text-right">已提交</th>
                <th className="text-right">累计有效时长</th>
                <th>状态</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.name} size={24} />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{m.name}</div>
                        <div className="truncate font-mono text-[10px] text-muted-foreground">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge tone={m.role === "ANNOTATOR" ? "muted" : "primary"}>
                      {ROLE_LABEL[m.role as keyof typeof ROLE_LABEL]}
                    </Badge>
                  </td>
                  {multi && <td className="text-xs text-muted-foreground">{m.tenant_name}</td>}
                  <td className="tnum text-right text-muted-foreground">{m.submitted_count}</td>
                  <td className="tnum text-right font-medium">{formatHuman(m.total_seconds)}</td>
                  <td>
                    <Badge tone={m.status === "ACTIVE" ? "success" : "danger"}>
                      {m.status === "ACTIVE" ? "正常" : "已停用"}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <UserStatusButton userId={m.id} status={m.status} disabled={m.id === user.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-4 text-[11px] text-muted-foreground/70">
        停用成员后其登录会话立即失效，已提交的历史记录仍保留在统计中。
      </p>
    </>
  );
}
