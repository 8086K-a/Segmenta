import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listTasks } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { TaskCard } from "@/components/TaskCard";
import { IconLayers, IconChevronRight, IconInbox } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function StudioIndexPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const isAnnotator = user.role === "ANNOTATOR";
  const tasks = listTasks(user, { scope: isAnnotator ? "mine" : "all", limit: 200 });

  // 标注员有进行中的任务时，直接进入工作台，少点一次
  if (isAnnotator) {
    const current = tasks
      .filter((t) => t.status === "IN_PROGRESS")
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    if (current) redirect(`/annotate/${current.id}`);
  }

  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");
  const submitted = tasks.filter((t) => t.status === "SUBMITTED");

  return (
    <>
      <PageHeader
        title="工作台"
        subtitle="标注编辑器。进行中的任务可直接继续标注，已提交的任务可以回看片段与时间轴。"
        meta={<Badge tone="muted">{inProgress.length + submitted.length} 个可打开</Badge>}
        actions={
          <Link
            href={isAnnotator ? "/hall" : "/tasks"}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            {isAnnotator ? "去任务大厅" : "任务列表"}
            <IconChevronRight size={13} />
          </Link>
        }
      />

      {inProgress.length === 0 ? (
        <div className="mt-6 rounded-lg bg-card ring-1 ring-foreground/10">
          <EmptyState
            icon={<IconLayers size={18} />}
            title="没有进行中的任务"
            desc={
              isAnnotator
                ? "去任务大厅领取一个任务，领取后会直接进入工作台。"
                : "所有任务都已提交。可以打开已提交的任务回看标注结果。"
            }
            action={
              <Link
                href={isAnnotator ? "/hall" : "/tasks"}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background"
              >
                <IconInbox size={13} />
                {isAnnotator ? "领取任务" : "去创建任务"}
              </Link>
            }
          />
        </div>
      ) : (
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-medium">进行中</h2>
            <Badge tone="warn">{inProgress.length}</Badge>
            <span className="text-xs text-muted-foreground">草稿已自动保存</span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {inProgress.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                href={`/annotate/${t.id}`}
                meta={
                  <>
                    {t.assignee_name ?? "未指派"} · 已标 {t.segment_count} 个片段 · 草稿{" "}
                    <span className="tnum">{t.draft_duration.toFixed(1)}</span> 秒
                  </>
                }
                footer={
                  <>
                    <span className="text-[10.5px] text-muted-foreground/70">
                      更新于 {formatDateTime(t.updated_at)}
                    </span>
                    <span className="inline-flex h-7 items-center rounded-sm border border-border px-2.5 text-sm transition-colors group-hover:bg-accent">
                      继续标注
                    </span>
                  </>
                }
              />
            ))}
          </div>
        </section>
      )}

      {submitted.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-medium">已提交</h2>
            <Badge tone="success">{submitted.length}</Badge>
            <span className="text-xs text-muted-foreground">只读，可在时间轴上回看</span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {submitted.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                href={`/annotate/${t.id}`}
                durationLabel={`${(t.submission_duration ?? 0).toFixed(1)}s`}
                meta={
                  <>
                    {t.submission_segments ?? 0} 个片段 · 计入 {t.submitted_date}
                  </>
                }
                footer={
                  <>
                    <span className="text-[10.5px] text-muted-foreground/70">
                      {formatDateTime(t.submitted_at)} 提交
                    </span>
                    <span className="text-[11px] text-primary transition-opacity group-hover:opacity-80">
                      查看结果
                    </span>
                  </>
                }
              />
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground/70">
        工作台支持逐帧步进（← / →）、拖拽建片段、两端裁剪、分割（S）与缩放（Ctrl + 滚轮）。
      </p>
    </>
  );
}
