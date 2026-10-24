import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessTenant, getSessionUser, tenantScope } from "@/lib/auth";
import { annotatorStats, dailyStats, listTenants, overview, recentActivity } from "@/lib/queries";
import { addDays, dateRange, formatClock, formatDateTime, formatHuman, splitDuration, todayBizDate } from "@/lib/time";
import { Avatar, Badge, Card, EmptyState, PageHeader, StatTile, StatusBadge } from "@/components/ui";
import { BarChart } from "@/components/BarChart";
import { TenantSelect } from "@/components/TenantSelect";
import { IconCheck, IconChevronRight } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "ANNOTATOR") redirect("/hall");

  const sp = await searchParams;
  const tenantId = sp.tenantId && canAccessTenant(user, sp.tenantId) ? sp.tenantId : null;
  const scope = tenantId ? [tenantId] : tenantScope(user);

  const today = todayBizDate();
  const from = addDays(today, -13);

  const o = overview(user, tenantId);
  const daily = dailyStats({ tenantIds: scope, from, to: today });
  const map = new Map(daily.map((d) => [d.day, d]));
  const series = dateRange(from, today).map((day) => ({
    label: day.slice(5).replace("-", "/"),
    value: map.get(day)?.seconds ?? 0,
    sub: `${map.get(day)?.tasks ?? 0} 个任务`,
    highlight: day === today,
  }));

  const leaderboard = annotatorStats(scope, addDays(today, -6), today);
  const activity = recentActivity(user, 7);
  const tenants = listTenants(user);

  const todaySplit = splitDuration(o.todaySeconds);
  const delta =
    o.yesterdaySeconds > 0
      ? Math.round(((o.todaySeconds - o.yesterdaySeconds) / o.yesterdaySeconds) * 100)
      : null;
  const maxLeader = Math.max(1, ...leaderboard.map((l) => l.seconds));

  return (
    <>
      <PageHeader
        title="概览"
        subtitle={`${today} · 有效时长按提交日期归集，只统计已提交任务的片段`}
        meta={
          <Badge tone={o.inProgress > 0 ? "warn" : "muted"}>
            {o.inProgress > 0 ? `${o.inProgress} 个任务进行中` : "无进行中任务"}
          </Badge>
        }
        actions={
          user.role === "SUPER_ADMIN" && tenants.length > 1 ? (
            <TenantSelect tenants={tenants.map((t) => ({ id: t.id, name: t.name }))} value={tenantId} />
          ) : null
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="今日有效时长"
          value={todaySplit.value}
          unit={todaySplit.unit}
          accent
          hint={
            delta === null
              ? `昨日 ${formatHuman(o.yesterdaySeconds)}`
              : `较昨日 ${delta >= 0 ? "+" : ""}${delta}%`
          }
        />
        <Link href="/tasks?tab=pending" className="block">
          <StatTile
            label="待审核"
            value={String(o.pendingReview)}
            unit="个任务"
            hint={o.pendingReview > 0 ? "需要你处理" : "暂无待审"}
          />
        </Link>
        <StatTile label="进行中" value={String(o.inProgress)} unit="个任务" hint="草稿不计入工时" />
        <StatTile label="待领取" value={String(o.available)} unit="个任务" hint={`${o.annotators} 名标注员`} />
        <StatTile label="近 7 天" value={formatHuman(o.weekSeconds)} hint={`今日 ${o.submittedToday} 个提交`} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-4">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-sm font-medium">每日有效时长</div>
              <div className="mt-0.5 text-xs text-muted-foreground">最近 14 天 · 按提交日期归集</div>
            </div>
            <Link
              href="/stats"
              className="flex items-center gap-0.5 text-xs text-primary transition-opacity hover:opacity-80"
            >
              详细统计
              <IconChevronRight size={11} />
            </Link>
          </div>
          <BarChart data={series} labelEvery={2} />
        </Card>

        <Card className="flex flex-col p-4">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="text-sm font-medium">标注员排行</div>
              <div className="mt-0.5 text-xs text-muted-foreground">近 7 天有效时长</div>
            </div>
            <Link href="/team" className="text-xs text-primary transition-opacity hover:opacity-80">
              团队
            </Link>
          </div>

          {leaderboard.length === 0 ? (
            <EmptyState title="暂无提交记录" desc="标注员提交任务后会出现在这里" />
          ) : (
            <div className="mt-1 space-y-3">
              {leaderboard.slice(0, 6).map((a, i) => (
                <div key={a.id} className="flex items-center gap-2.5">
                  <span className="w-2.5 text-[10px] tabular-nums text-muted-foreground">{i + 1}</span>
                  <Avatar name={a.name} size={22} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs">{a.name}</span>
                      <span className="tnum shrink-0 text-[11px] text-muted-foreground">
                        {formatHuman(a.seconds)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-foreground/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(3, (a.seconds / maxLeader) * 100)}%`,
                          background:
                            i === 0
                              ? "color-mix(in oklch, var(--foreground) 75%, transparent)"
                              : "color-mix(in oklch, var(--foreground) 25%, transparent)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-3 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-medium">最近提交</div>
          <Link href="/stats" className="text-xs text-primary transition-opacity hover:opacity-80">
            查看全部
          </Link>
        </div>

        {activity.length === 0 ? (
          <EmptyState
            icon={<IconCheck size={18} />}
            title="还没有提交记录"
            desc="创建任务并让标注员领取，提交后会在这里显示"
            action={
              <Link href="/tasks" className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-sm font-medium text-background">
                去创建任务
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>任务</th>
                  <th>标注员</th>
                  <th>租户</th>
                  <th className="text-right">片段</th>
                  <th className="text-right">有效时长</th>
                  <th className="text-right">提交时间</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={`${a.task_id}-${a.submitted_at}`}>
                    <td>
                      <Link href={`/tasks/${a.task_id}`} className="font-medium transition-colors hover:text-primary">
                        {a.title}
                      </Link>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={a.annotator} size={20} />
                        <span className="text-xs">{a.annotator}</span>
                      </div>
                    </td>
                    <td className="text-xs text-muted-foreground">{a.tenant_name}</td>
                    <td className="tnum text-right text-muted-foreground">{a.segment_count}</td>
                    <td className="tnum text-right font-medium">{formatClock(a.total_duration)}</td>
                    <td className="tnum text-right text-xs text-muted-foreground">
                      {formatDateTime(a.submitted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">
        有效时长 = 已提交任务中所有片段长度之和，未提交的草稿不计入。任务被退回后当前版本作废，统计同步移除。
      </p>
    </>
  );
}
