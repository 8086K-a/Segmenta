import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessTenant, getSessionUser, tenantScope } from "@/lib/auth";
import { listTasks, listTenants } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";
import { Avatar, EmptyState, Input, PageHeader } from "@/components/ui";
import { CreateTaskButton } from "@/components/CreateTaskButton";
import { TenantSelect } from "@/components/TenantSelect";
import { TaskCard } from "@/components/TaskCard";
import { IconList, IconSearch } from "@/components/icons";
import type { TaskFilter } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "全部" },
  { key: "available", label: "待领取" },
  { key: "progress", label: "进行中" },
  { key: "pending", label: "待审核" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已退回" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function toFilter(tab: TabKey): Pick<TaskFilter, "status" | "review"> {
  switch (tab) {
    case "available":
      return { status: "AVAILABLE" };
    case "progress":
      return { status: "IN_PROGRESS" };
    case "pending":
      return { review: "PENDING" };
    case "approved":
      return { review: "APPROVED" };
    case "rejected":
      return { review: "REJECTED" };
    default:
      return { status: "ALL" };
  }
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; tenantId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "ANNOTATOR") redirect("/hall");

  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "all") as TabKey;
  const q = sp.q?.trim() || "";
  const tenantId = sp.tenantId && canAccessTenant(user, sp.tenantId) ? sp.tenantId : null;

  const tasks = listTasks(user, { scope: "all", ...toFilter(tab), q, tenantId, limit: 200 });
  const tenants = listTenants(user);

  const withQuery = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      tab: tab === "all" ? undefined : tab,
      q: q || undefined,
      tenantId: tenantId ?? undefined,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/tasks?${s}` : "/tasks";
  };

  return (
    <>
      <PageHeader
        title="任务"
        subtitle="发布标注任务、审核提交结果。审核不通过会退回给标注员修改，退回的版本不计入工时。"
        meta={<span className="text-xs text-muted-foreground">{tasks.length} 个</span>}
        actions={
          <>
            {user.role === "SUPER_ADMIN" && tenants.length > 1 && (
              <TenantSelect tenants={tenants.map((t) => ({ id: t.id, name: t.name }))} value={tenantId} />
            )}
            <CreateTaskButton
              tenants={tenants.map((t) => ({ id: t.id, name: t.name }))}
              defaultTenantId={tenantId ?? user.tenantId}
            />
          </>
        }
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-0.5 rounded-lg bg-muted p-[3px]">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={withQuery({ tab: t.key === "all" ? undefined : t.key })}
              className={`flex h-6 items-center rounded-md px-2 text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <form action="/tasks" className="relative">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          {tenantId && <input type="hidden" name="tenantId" value={tenantId} />}
          <IconSearch
            size={13}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input name="q" defaultValue={q} placeholder="搜索任务或视频" className="w-[200px] pl-7" />
        </form>
      </div>

      {tasks.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconList size={18} />}
            title="没有符合条件的任务"
            desc={q ? `没有找到与“${q}”匹配的任务` : "换个筛选条件，或创建第一个标注任务"}
          />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              href={`/tasks/${t.id}`}
              meta={
                <span className="flex items-center gap-1.5">
                  {t.assignee_name ? (
                    <>
                      <Avatar name={t.assignee_name} size={16} />
                      <span>{t.assignee_name}</span>
                    </>
                  ) : (
                    <span>未指派 · 大厅可领取</span>
                  )}
                  <span className="text-muted-foreground/50">·</span>
                  <span className="tnum">{formatDateTime(t.submitted_at ?? t.created_at)}</span>
                </span>
              }
              footer={
                <>
                  <span className="flex items-center gap-1.5">
                    <span>
                      {t.status === "SUBMITTED" ? (t.submission_segments ?? 0) : t.segment_count} 个片段
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="tnum">
                      {t.status === "SUBMITTED" && t.submission_duration != null
                        ? `${t.submission_duration.toFixed(1)} 秒有效`
                        : t.status === "IN_PROGRESS"
                          ? `草稿 ${t.draft_duration.toFixed(1)} 秒`
                          : "未开始"}
                    </span>
                  </span>
                  <span className="truncate font-mono text-[0.625rem] text-muted-foreground/60">
                    {t.tenant_name}
                  </span>
                </>
              }
            />
          ))}
        </div>
      )}

      <p className="mt-6 text-[11px] text-muted-foreground/70">
        待审核 / 已通过的任务按提交日期计入工时；退回后该版本作废，修改重新提交才会计入。
      </p>
    </>
  );
}
