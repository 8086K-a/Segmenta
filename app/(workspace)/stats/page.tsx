import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessTenant, getSessionUser, tenantScope } from "@/lib/auth";
import { annotatorStats, dailyStats, listTenants, listUsers, taskStats } from "@/lib/queries";
import { addDays, dateRange, formatClock, formatDateTime, formatHuman, splitDuration, todayBizDate } from "@/lib/time";
import { Avatar, Card, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { BarChart } from "@/components/BarChart";
import { TenantSelect } from "@/components/TenantSelect";
import { StatsFilters } from "@/components/StatsFilters";
import { IconChart, IconDownload } from "@/components/icons";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tenantId?: string; annotatorId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "ANNOTATOR") redirect("/my-tasks");

  const sp = await searchParams;
  const today = todayBizDate();
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : today;
  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : addDays(to, -13);
  const tenantId = sp.tenantId && canAccessTenant(user, sp.tenantId) ? sp.tenantId : null;
  const annotatorId = sp.annotatorId || null;

  const scope = tenantId ? [tenantId] : tenantScope(user);
  const tenants = listTenants(user);
  const members = listUsers(user, tenantId).filter((m) => m.role === "ANNOTATOR");

  const daily = dailyStats({ tenantIds: scope, from, to, annotatorId });
  const map = new Map(daily.map((d) => [d.day, d]));
  const days = dateRange(from, to);
  const series = days.map((day) => ({
    label: day.slice(5).replace("-", "/"),
    value: map.get(day)?.seconds ?? 0,
    sub: `${map.get(day)?.tasks ?? 0} 个任务 · ${map.get(day)?.segments ?? 0} 段`,
    highlight: day === today,
  }));

  const totalSeconds = daily.reduce((s, d) => s + d.seconds, 0);
  const totalTasks = daily.reduce((s, d) => s + d.tasks, 0);
  const totalSegments = daily.reduce((s, d) => s + d.segments, 0);
  const perAnnotator = annotatorStats(scope, from, to).filter((a) => !annotatorId || a.id === annotatorId);
  const details = taskStats(scope, from, to, annotatorId);

  const split = splitDuration(totalSeconds);
  const activeDays = daily.filter((d) => d.seconds > 0).length;
  const maxDay = Math.max(1, ...daily.map((d) => d.seconds));

  const exportBase = `/api/export?from=${from}&to=${to}${tenantId ? `&tenantId=${tenantId}` : ""}`;

  return (
    <>
      <PageHeader
        title="工作量统计"
        subtitle="有效时长 = 已提交任务中所有片段的长度之和，按任务提交日期归集。未提交的草稿不计入。"
        actions={
          <>
            {user.role === "SUPER_ADMIN" && tenants.length > 1 && (
              <TenantSelect tenants={tenants.map((t) => ({ id: t.id, name: t.name }))} value={tenantId} />
            )}
            <a
              href={`${exportBase}&type=tasks`}
              download
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <IconDownload size={13} />
              导出汇总
            </a>
            <a
              href={`${exportBase}&type=segments`}
              download
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <IconDownload size={13} />
              导出片段
            </a>
          </>
        }
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
        <div className="flex items-center rounded-md border border-border p-1">
          {[
            { label: "今日", from: today, to: today },
            { label: "近 7 天", from: addDays(today, -6), to: today },
            { label: "近 14 天", from: addDays(today, -13), to: today },
            { label: "近 30 天", from: addDays(today, -29), to: today },
          ].map((p) => {
            const active = p.from === from && p.to === to;
            const href = `/stats?from=${p.from}&to=${p.to}${tenantId ? `&tenantId=${tenantId}` : ""}${
              annotatorId ? `&annotatorId=${annotatorId}` : ""
            }`;
            return (
              <Link
                key={p.label}
                href={href}
                className={`flex h-7 items-center rounded-sm px-2.5 text-sm transition-colors ${
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
        <StatsFilters
          from={from}
          to={to}
          annotatorId={annotatorId}
          annotators={members.map((m) => ({ id: m.id, name: m.name }))}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="区间有效时长"
          value={split.value}
          unit={split.unit}
          accent
          hint={`${formatClock(totalSeconds)} · ${activeDays} 天有提交`}
        />
        <StatTile label="提交任务数" value={String(totalTasks)} hint={`共 ${totalSegments} 个片段`} />
        <StatTile
          label="平均每任务"
          value={totalTasks ? (totalSeconds / totalTasks).toFixed(1) : "0"}
          unit="秒"
          hint="按当前筛选条件"
        />
        <StatTile label="活跃标注员" value={String(perAnnotator.length)} hint="有提交记录的人数" />
      </div>

      <Card className="mt-3 p-4">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="text-sm font-medium">每日有效时长</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {from} 至 {to}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">峰值 {Math.round(maxDay)} 秒</div>
        </div>
        <BarChart data={series} height={200} labelEvery={days.length > 16 ? 3 : days.length > 8 ? 2 : 1} />
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.3fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3 text-sm font-medium">按标注员</div>
          {perAnnotator.length === 0 ? (
            <EmptyState icon={<IconChart size={17} />} title="区间内没有提交" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>标注员</th>
                  <th className="text-right">任务</th>
                  <th className="text-right">有效时长</th>
                </tr>
              </thead>
              <tbody>
                {perAnnotator.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={a.name} size={20} />
                        <span className="text-xs">{a.name}</span>
                      </div>
                    </td>
                    <td className="tnum text-right text-muted-foreground">{a.tasks}</td>
                    <td className="tnum text-right">
                      <span className="font-medium">{formatHuman(a.seconds)}</span>
                      <span className="ml-1.5 text-[10.5px] text-muted-foreground">{a.seconds.toFixed(0)}s</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-medium">每日明细</div>
            <span className="text-xs text-muted-foreground">{days.length} 天</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
            <table className="table">
              <thead className="sticky top-0 bg-card">
                <tr>
                  <th>日期</th>
                  <th className="text-right">任务</th>
                  <th className="text-right">片段</th>
                  <th className="text-right">有效时长</th>
                  <th className="w-[84px]">占比</th>
                </tr>
              </thead>
              <tbody>
                {days
                  .slice()
                  .reverse()
                  .map((day) => {
                    const d = map.get(day);
                    return (
                      <tr key={day}>
                        <td className="tnum text-xs">{day}</td>
                        <td className="tnum text-right text-muted-foreground">{d?.tasks ?? 0}</td>
                        <td className="tnum text-right text-muted-foreground">{d?.segments ?? 0}</td>
                        <td className="tnum text-right font-medium">
                          {d ? `${d.seconds.toFixed(1)}s` : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td>
                          <div className="h-1 overflow-hidden rounded-full bg-accent">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${d ? Math.max(2, (d.seconds / maxDay) * 100) : 0}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-3 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-medium">提交明细</div>
          <span className="text-xs text-muted-foreground">仅显示当前有效版本</span>
        </div>
        {details.length === 0 ? (
          <EmptyState title="区间内没有提交记录" desc="调整日期范围或筛选条件试试" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>任务</th>
                  <th>租户</th>
                  <th>标注员</th>
                  <th className="text-right">片段</th>
                  <th className="text-right">有效时长</th>
                  <th>版本</th>
                  <th className="text-right">提交时间</th>
                </tr>
              </thead>
              <tbody>
                {details.map((d) => (
                  <tr key={`${d.task_id}-${d.submitted_at}`}>
                    <td className="max-w-[260px]">
                      <Link href={`/tasks/${d.task_id}`} className="block truncate font-medium transition-colors hover:text-primary">
                        {d.title}
                      </Link>
                    </td>
                    <td className="text-xs text-muted-foreground">{d.tenant_name}</td>
                    <td className="text-xs">{d.annotator}</td>
                    <td className="tnum text-right text-muted-foreground">{d.segment_count}</td>
                    <td className="tnum text-right font-medium">{formatClock(d.total_duration)}</td>
                    <td>
                      <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                        v{d.version}
                      </span>
                    </td>
                    <td className="tnum text-right text-xs text-muted-foreground">
                      {formatDateTime(d.submitted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">
        任务被退回后当前版本作废，历史统计会同步移除；重新提交后计入新的提交日期。有效时长衡量的是被标注的片段长度，不等于标注员的实际工作时长。
      </p>
    </>
  );
}
