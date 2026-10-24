import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { dailyStats, listTasks } from "@/lib/queries";
import { addDays, formatDateTime, formatHuman, todayBizDate } from "@/lib/time";
import { Badge, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { TaskCard } from "@/components/TaskCard";
import { IconCheck, IconChevronRight, IconPlay } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ANNOTATOR") redirect("/tasks");

  const tasks = listTasks(user, { scope: "mine" });
  const today = todayBizDate();
  const week = dailyStats({ tenantIds: [user.tenantId], from: addDays(today, -6), to: today, annotatorId: user.id });
  const todayStat = week.find((d) => d.day === today);
  const weekSeconds = week.reduce((s, d) => s + d.seconds, 0);

  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");
  const submitted = tasks.filter((t) => t.status === "SUBMITTED");

  return (
    <>
      <PageHeader
        title="我的任务"
        subtitle="进行中的草稿会自动保存；提交后版本锁定，需要修改请联系管理员退回。"
        actions={
          <Link
            href="/hall"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            去任务大厅
            <IconChevronRight size={13} />
          </Link>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="今日有效时长"
          value={(todayStat?.seconds ?? 0).toFixed(1)}
          unit="秒"
          accent
          hint={`${todayStat?.tasks ?? 0} 个任务已提交`}
        />
        <StatTile label="近 7 天" value={formatHuman(weekSeconds)} />
        <StatTile label="进行中" value={String(inProgress.length)} unit="个" />
        <StatTile label="已提交" value={String(submitted.length)} unit="个" />
      </div>

      <section className="mt-7">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-medium">进行中</h2>
          <Badge tone="warn">{inProgress.length}</Badge>
        </div>

        {inProgress.length === 0 ? (
          <div className="rounded-lg bg-card ring-1 ring-foreground/10">
            <EmptyState
              icon={<IconPlay size={17} />}
              title="没有进行中的任务"
              desc="去任务大厅领取一个，领取后会出现在这里"
              action={
                <Link
                  href="/hall"
                  className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-sm font-medium text-background"
                >
                  领取任务
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {inProgress.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                href={`/annotate/${t.id}`}
                meta={
                  <>
                    已标 {t.segment_count} 个片段 · 草稿{" "}
                    <span className="tnum">{t.draft_duration.toFixed(1)}</span> 秒
                  </>
                }
                footer={
                  <>
                    <span className="text-[10.5px] text-muted-foreground/70">未提交不计入工时</span>
                    <span className="inline-flex h-7 items-center rounded-sm border border-border px-2.5 text-sm transition-colors group-hover:bg-accent">
                      继续标注
                    </span>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-medium">已提交</h2>
          <Badge tone="success">{submitted.length}</Badge>
        </div>

        {submitted.length === 0 ? (
          <div className="rounded-lg bg-card ring-1 ring-foreground/10">
            <EmptyState
              icon={<IconCheck size={17} />}
              title="还没有提交记录"
              desc="提交后的任务会显示在这里，并计入当天有效工时"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {submitted.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                href={`/annotate/${t.id}`}
                durationLabel={`${(t.submission_duration ?? 0).toFixed(1)}s`}
                meta={
                  <>
                    {t.submission_segments ?? 0} 个片段 · {formatDateTime(t.submitted_at)}
                  </>
                }
                footer={
                  <>
                    <span className="text-[10.5px] text-muted-foreground/70">计入 {t.submitted_date}</span>
                    <span className="text-[11px] text-primary transition-opacity group-hover:opacity-80">
                      查看结果
                    </span>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
