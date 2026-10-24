import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listTasks } from "@/lib/queries";
import { formatDateTime, formatHuman, todayBizDate } from "@/lib/time";
import { Badge, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { ClaimButton } from "@/components/ClaimButton";
import { TaskCard } from "@/components/TaskCard";
import { IconChevronRight, IconInbox } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function HallPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ANNOTATOR") redirect("/tasks");

  const available = listTasks(user, { scope: "hall" });
  const mine = listTasks(user, { scope: "mine", status: "IN_PROGRESS" });
  const totalSeconds = available.reduce((s, t) => s + (t.video_duration ?? 0), 0);

  return (
    <>
      <PageHeader
        title="任务大厅"
        subtitle={`${user.tenantName} 租户下待领取的标注任务。领取后任务归你所有，其他人不可见。`}
        meta={<span className="text-xs text-muted-foreground">{available.length} 个可领取</span>}
        actions={
          <Link
            href="/my-tasks"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            我的任务
            <IconChevronRight size={13} />
          </Link>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="可领取" value={String(available.length)} unit="个任务" accent />
        <StatTile label="进行中" value={String(mine.length)} unit="个任务" hint="草稿不会计入工时" />
        <StatTile label="待标注视频总长" value={formatHuman(totalSeconds)} />
      </div>

      {mine.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-caution/25 bg-caution/[0.07] px-3.5 py-2.5">
          <span className="text-xs font-medium text-caution">你有 {mine.length} 个任务未提交</span>
          <span className="text-xs text-muted-foreground">未提交的草稿不会计入有效工时</span>
          <Link
            href={`/annotate/${mine[0].id}`}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-caution transition-opacity hover:opacity-80"
          >
            继续标注
            <IconChevronRight size={11} />
          </Link>
        </div>
      )}

      {available.length === 0 ? (
        <div className="mt-6 rounded-lg bg-card ring-1 ring-foreground/10">
          <EmptyState
            icon={<IconInbox size={18} />}
            title="暂时没有可领取的任务"
            desc="管理员发布新任务后会出现在这里。你也可以先看看自己的进行中任务。"
            action={
              <Link
                href="/my-tasks"
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
              >
                查看我的任务
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {available.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              badge={<Badge tone="muted">待领取</Badge>}
              meta={<span className="line-clamp-2">{t.description || "无补充说明"}</span>}
              footer={
                <>
                  <span className="tnum text-[10.5px] text-muted-foreground/70">
                    {formatDateTime(t.created_at)} 创建
                  </span>
                  <ClaimButton taskId={t.id} small />
                </>
              }
            />
          ))}
        </div>
      )}

      <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground/70">
        今日有效工时按已提交任务的片段时长计算，归入提交当天（{todayBizDate()}）。
      </p>
    </>
  );
}
