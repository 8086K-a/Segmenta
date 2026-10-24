import Link from "next/link";
import { formatClock } from "@/lib/time";
import { StatusBadge } from "./ui";
import { VideoThumb } from "./VideoThumb";
import type { TaskSummary } from "@/lib/types";

/**
 * 列表卡片：16:9 视频首帧 + 时长胶囊 + 标题 + 元信息 + 底部操作
 */
export function TaskCard({
  task,
  href,
  meta,
  footer,
  durationLabel,
  badge,
}: {
  task: TaskSummary;
  href?: string;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  durationLabel?: string;
  badge?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 transition-all group-hover:ring-foreground/25">
        <VideoThumb videoId={task.video_id} />
        <div className="absolute top-1.5 left-1.5">{badge ?? <StatusBadge status={task.status} reviewStatus={task.review_status} />}</div>
        <div className="absolute right-1.5 bottom-1.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[0.625rem] font-medium tabular-nums backdrop-blur-sm">
          {durationLabel ?? formatClock(task.video_duration ?? 0)}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <h3 className="line-clamp-1 text-xs font-medium">{task.title}</h3>
        {meta && (
          <div className="line-clamp-1 text-[0.6875rem] text-muted-foreground">{meta}</div>
        )}
        {footer && <div className="mt-0.5 flex items-center justify-between gap-2">{footer}</div>}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="group flex flex-col gap-2">
        {body}
      </Link>
    );
  }
  return <div className="group flex flex-col gap-2">{body}</div>;
}
