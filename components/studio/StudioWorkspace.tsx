"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { findOverlaps, sumDuration } from "@/lib/segment-utils";
import { FPS_PRESETS, frameIndex, timecode } from "@/lib/timecode";
import { formatDateTime } from "@/lib/time";
import { TimelineEditor, type StudioSegment } from "./TimelineEditor";
import { useVideoFps } from "./useVideoFps";
import { Badge, Button, Modal, StatusBadge } from "@/components/ui";
import { Kbd } from "@/components/shadcn/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { ThemeToggle } from "@/components/theme";
import {
  IconAlert,
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconPause,
  IconPlay,
  IconSkipEnd,
  IconSkipStart,
  IconStepBack,
  IconStepFwd,
  IconPlus,
  IconTarget,
  IconTrash,
} from "@/components/icons";

export type StudioTask = {
  id: string;
  title: string;
  description: string | null;
  status: "AVAILABLE" | "IN_PROGRESS" | "SUBMITTED";
  tenantName: string;
  assigneeName: string | null;
  videoId: string;
  videoFilename: string;
  videoDuration: number | null;
  editable: boolean;
  reviewStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  reviewComment: string | null;
  reviewedAt: string | null;
  submission: { version: number; totalDuration: number; segmentCount: number; submittedAt: string } | null;
};

type SaveState = "saved" | "dirty" | "saving" | "error";

export type SwitchableTask = {
  id: string;
  title: string;
  status: "IN_PROGRESS" | "SUBMITTED";
  segments: number;
  seconds: number;
};

export function StudioWorkspace({
  task,
  initialSegments,
  backHref = "/my-tasks",
  switchable = [],
  listHref = "/studio",
}: {
  task: StudioTask;
  initialSegments: StudioSegment[];
  backHref?: string;
  switchable?: SwitchableTask[];
  listHref?: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedSnapshot = useRef(snapshotOf(initialSegments));

  const [duration, setDuration] = useState(task.videoDuration ?? 0);
  const [segments, setSegments] = useState<StudioSegment[]>(initialSegments);
  const [selectedId, setSelectedId] = useState<string | null>(initialSegments[0]?.id ?? null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [markStart, setMarkStart] = useState<number | null>(null);

  const { fps, setManual } = useVideoFps(videoRef, playing);

  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const dirtyRef = useRef(false);
  const didInitSeek = useRef(false);

  const conflicts = useMemo(() => findOverlaps(segments), [segments]);
  const total = useMemo(() => sumDuration(segments), [segments]);
  const selected = segments.find((s) => s.id === selectedId) ?? null;
  const totalFrames = Math.max(0, frameIndex(duration, fps));

  const seek = useCallback(
    (t: number) => {
      const v = videoRef.current;
      const max = duration || v?.duration || 0;
      const clamped = Math.max(0, Math.min(max, t));
      if (v) v.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [duration],
  );

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => setLoadError(true));
    else v.pause();
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) setCurrentTime((prev) => (Math.abs(v.currentTime - prev) > 0.02 ? v.currentTime : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 长视频默认跳到第一个片段，避免打开后整段看不到内容
  useEffect(() => {
    const v = videoRef.current;
    if (!v || didInitSeek.current || initialSegments.length === 0) return;
    const target = initialSegments[0].start;

    const apply = () => {
      if (didInitSeek.current) return;
      const d = v.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      didInitSeek.current = true;
      const t = Math.max(0, Math.min(target, d - 0.1));
      v.currentTime = t;
      setCurrentTime(t);
    };

    if (v.readyState >= 2) apply();
    else v.addEventListener("loadeddata", apply, { once: true });
    return () => v.removeEventListener("loadeddata", apply);
  }, [initialSegments]);

  const stepFrame = useCallback(
    (dir: 1 | -1) => {
      const v = videoRef.current;
      if (v) v.pause();
      seek(Math.round((currentTime + dir / fps) * fps) / fps);
    },
    [currentTime, fps, seek],
  );

  const persist = useCallback(
    async (list: StudioSegment[]) => {
      if (!task.editable) return;
      setSaveState("saving");
      try {
        await api(`/api/tasks/${task.id}/segments`, {
          method: "PUT",
          body: JSON.stringify({
            segments: list.map((s) => ({ start: s.start, end: s.end, label: s.label ?? null })),
          }),
        });
        savedSnapshot.current = snapshotOf(list);
        dirtyRef.current = false;
        setSaveState("saved");
        setLastSavedAt(new Date().toISOString());
      } catch (err) {
        setSaveState("error");
        if (err instanceof ApiClientError) setSubmitError(err.message);
      }
    },
    [task.editable, task.id],
  );

  useEffect(() => {
    if (!task.editable) return;
    // 与上次落库的内容一致就不写（也避免 StrictMode 双执行时多余的一次保存）
    if (snapshotOf(segments) === savedSnapshot.current) return;
    dirtyRef.current = true;
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (conflicts.size > 0) return;
    saveTimer.current = setTimeout(() => void persist(segmentsRef.current), 1100);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [segments, conflicts.size, persist, task.editable]);

  /** N：第一次打起点，移动播放头后再按一次确认终点 */
  const toggleMark = useCallback(() => {
    if (!task.editable) return;

    if (markStart === null) {
      setMarkStart(currentTime);
      setSelectedId(null);
      return;
    }

    const start = Math.round(Math.min(markStart, currentTime) * 1000) / 1000;
    const end = Math.round(Math.max(markStart, currentTime) * 1000) / 1000;
    if (end - start < 1 / fps) return; // 太短，继续保持标记

    const seg: StudioSegment = {
      id: `seg_${Math.random().toString(36).slice(2, 10)}`,
      start,
      end,
      label: null,
    };
    setSegments((prev) => [...prev, seg].sort((a, b) => a.start - b.start));
    setSelectedId(seg.id);
    setMarkStart(null);
  }, [currentTime, fps, markStart, task.editable]);

  const updateSegment = useCallback((id: string, patch: Partial<StudioSegment>) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeSegment = useCallback((id: string | null) => {
    if (!id) return;
    setSegments((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const duplicateSegment = useCallback(() => {
    if (!selected) return;
    const len = selected.end - selected.start;
    const start = Math.min(selected.end + 0.2, Math.max(0, duration - len));
    const seg: StudioSegment = {
      id: `seg_${Math.random().toString(36).slice(2, 10)}`,
      start: Math.round(start * 1000) / 1000,
      end: Math.round((start + len) * 1000) / 1000,
      label: selected.label,
    };
    setSegments((prev) => [...prev, seg].sort((a, b) => a.start - b.start));
    setSelectedId(seg.id);
  }, [duration, selected]);

  const splitAtPlayhead = useCallback(() => {
    const target =
      selected && currentTime > selected.start && currentTime < selected.end
        ? selected
        : segments.find((s) => currentTime > s.start && currentTime < s.end);
    if (!target) return;
    const cut = Math.round(currentTime * 1000) / 1000;
    const right: StudioSegment = {
      id: `seg_${Math.random().toString(36).slice(2, 10)}`,
      start: cut,
      end: target.end,
      label: target.label,
    };
    setSegments((prev) =>
      prev
        .map((s) => (s.id === target.id ? { ...s, end: cut } : s))
        .concat(right)
        .sort((a, b) => a.start - b.start),
    );
    setSelectedId(right.id);
  }, [currentTime, segments, selected]);

  // 切换任务 / 离开工作台前，把还没落库的草稿补存一次
  useEffect(() => {
    const taskId = task.id;
    return () => {
      if (!dirtyRef.current || !task.editable) return;
      void fetch(`/api/tasks/${taskId}/segments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          segments: segmentsRef.current.map((s) => ({ start: s.start, end: s.end, label: s.label ?? null })),
        }),
      });
    };
  }, [task.id, task.editable]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;

      if (e.code === "Space") {
        e.preventDefault();
        toggle();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        if (e.shiftKey) seek(currentTime + dir);
        else stepFrame(dir as 1 | -1);
        return;
      }
      if (e.key === "Escape") {
        if (markStart !== null) setMarkStart(null);
        else setSelectedId(null);
        return;
      }
      if (!task.editable) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        toggleMark();
      }
      if ((e.key === "s" || e.key === "S") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        splitAtPlayhead();
      }
      if ((e.key === "i" || e.key === "I") && selected) {
        e.preventDefault();
        updateSegment(selected.id, { start: Math.min(currentTime, selected.end - 1 / fps) });
      }
      if ((e.key === "o" || e.key === "O") && selected) {
        e.preventDefault();
        updateSegment(selected.id, { end: Math.max(currentTime, selected.start + 1 / fps) });
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        removeSegment(selectedId);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateSegment();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    currentTime,
    duplicateSegment,
    fps,
    removeSegment,
    seek,
    selected,
    selectedId,
    splitAtPlayhead,
    stepFrame,
    task.editable,
    toggle,
    toggleMark,
    updateSegment,
    markStart,
  ]);

  async function submit() {
    if (conflicts.size > 0) return setSubmitError("存在重叠片段，请先调整");
    if (segments.length === 0) return setSubmitError("至少标注一个时间段");
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await api(`/api/tasks/${task.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          segments: segments.map((s) => ({ start: s.start, end: s.end, label: s.label ?? null })),
        }),
      });
      setConfirmOpen(false);
      router.push("/my-tasks");
      router.refresh();
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err instanceof ApiClientError ? err.message : "提交失败，请重试");
    }
  }

  const saveLabel =
    saveState === "saving"
      ? "保存中…"
      : saveState === "dirty"
        ? "未保存"
        : saveState === "error"
          ? "保存失败"
          : lastSavedAt
            ? `已保存 ${new Date(lastSavedAt).toLocaleTimeString("zh-CN", { hour12: false }).slice(0, 5)}`
            : "自动保存";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/70 px-2.5">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            asChildHref={backHref}
            title="返回任务列表"
            aria-label="返回任务列表"
            className="shrink-0 gap-1.5 px-1.5"
          >
            <IconArrowLeft size={14} />
            <span className="hidden sm:inline">返回</span>
          </Button>

          <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
                  title="切换任务"
                >
                  <span className="truncate">{task.title}</span>
                  <IconChevronDown size={12} className="shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[420px] w-[330px] overflow-y-auto">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>切换任务 · {switchable.length}</DropdownMenuLabel>
                    {switchable.map((t) => {
                    const active = t.id === task.id;
                    return (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => {
                          if (!active) router.push(`/annotate/${t.id}`);
                        }}
                        className="flex items-center gap-2"
                      >
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${
                            t.status === "IN_PROGRESS" ? "bg-warning" : "bg-success"
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        <span className="shrink-0 text-[0.625rem] tabular-nums text-muted-foreground">
                          {t.segments} 段 · {t.seconds.toFixed(1)}s
                        </span>
                        {active && <IconCheck size={12} className="shrink-0" />}
                      </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(listHref)}>
                    查看全部任务
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <StatusBadge status={task.status} reviewStatus={task.reviewStatus} />
            </div>
            <div className="truncate font-mono text-[0.625rem] text-muted-foreground">
              {task.videoFilename} · {task.tenantName}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {task.editable && (
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <span
                className={`size-1.5 rounded-full ${
                  saveState === "saving" || saveState === "dirty"
                    ? "bg-caution"
                    : saveState === "error"
                      ? "bg-destructive"
                      : "bg-constructive"
                }`}
              />
              {saveLabel}
            </span>
          )}
          {task.editable ? (
            <>
              <Button variant="outline" size="sm" onClick={() => void persist(segments)} disabled={saveState === "saving"}>
                保存草稿
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSubmitError(null);
                  setConfirmOpen(true);
                }}
                disabled={segments.length === 0}
              >
                提交标注
              </Button>
            </>
          ) : (
            <Badge tone={task.reviewStatus === "APPROVED" ? "success" : task.status === "SUBMITTED" ? "primary" : "muted"}>
              {task.status === "SUBMITTED"
                ? `${task.reviewStatus === "APPROVED" ? "已通过" : "待审核"} · v${task.submission?.version ?? 1}`
                : "只读视图"}
            </Badge>
          )}
        </div>
      </header>

      {task.status === "IN_PROGRESS" && task.reviewStatus === "REJECTED" && (
        <div className="mx-2.5 mt-2.5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2">
          <IconAlert size={14} className="mt-0.5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-destructive">任务被退回，请修改后重新提交</div>
            {task.reviewComment && (
              <div className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
                {task.reviewComment}
              </div>
            )}
          </div>
          {task.reviewedAt && (
            <span className="shrink-0 text-[0.625rem] text-muted-foreground">
              {formatDateTime(task.reviewedAt)}
            </span>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-2.5 px-2.5 pt-2.5">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
          <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border/70 px-2.5 text-[0.625rem] text-muted-foreground">
            <span className="truncate font-mono">{task.videoFilename}</span>
            <span className="ml-auto flex items-center gap-2">
              <span className="rounded-sm border border-border px-1 py-0.5 tnum">{fps} fps</span>
              <span className="tnum">{totalFrames} 帧</span>
            </span>
          </div>

          <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
            <video
              ref={videoRef}
              src={`/api/videos/${task.videoId}/stream`}
              className="absolute inset-0 size-full object-contain"
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) setDuration(d);
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={() => setLoadError(true)}
              onClick={toggle}
            />
            {loadError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <IconAlert size={18} />
                视频加载失败，请检查文件或网络
              </div>
            )}
          </div>

          <div className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-t border-border/70 px-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="s-timecode text-xs text-foreground">{timecode(currentTime, fps)}</span>
              <span className="text-[11px] text-muted-foreground/50">/</span>
              <span className="s-timecode text-[11px] text-muted-foreground">{timecode(duration, fps)}</span>
            </div>

            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" onClick={() => seek(0)} title="回到开头">
                <IconSkipStart size={13} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => stepFrame(-1)} title="上一帧（←）">
                <IconStepBack size={14} />
              </Button>
              <button
                onClick={toggle}
                className="mx-1 flex size-8 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition hover:bg-foreground/90"
                aria-label={playing ? "暂停" : "播放"}
              >
                {playing ? <IconPause size={12} /> : <IconPlay size={12} />}
              </button>
              <Button variant="ghost" size="icon" onClick={() => stepFrame(1)} title="下一帧（→）">
                <IconStepFwd size={14} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => seek(duration)} title="跳到结尾">
                <IconSkipEnd size={13} />
              </Button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <span className="s-timecode hidden text-[10.5px] text-muted-foreground sm:inline">
                帧 {frameIndex(currentTime, fps)}
              </span>
              <select
                value={fps}
                onChange={(e) => setManual(Number(e.target.value))}
                className="h-6 cursor-pointer rounded-sm border border-border bg-input px-1 text-[10.5px] text-muted-foreground outline-none"
                title="帧率（自动检测，可手动指定）"
              >
                {FPS_PRESETS.map((f) => (
                  <option key={f} value={f}>
                    {f} fps
                  </option>
                ))}
              </select>
              <select
                value={rate}
                onChange={(e) => {
                  const r = Number(e.target.value);
                  setRate(r);
                  if (videoRef.current) videoRef.current.playbackRate = r;
                }}
                className="h-6 cursor-pointer rounded-sm border border-border bg-input px-1 text-[10.5px] text-muted-foreground outline-none"
                title="播放速度"
              >
                {[0.25, 0.5, 1, 1.5, 2].map((r) => (
                  <option key={r} value={r}>
                    {r}×
                  </option>
                ))}
              </select>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  if (videoRef.current) videoRef.current.volume = v;
                }}
                className="h-1 w-14 cursor-pointer accent-[hsl(200_90%_52%)]"
                aria-label="音量"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const el = stageRef.current;
                  if (!el) return;
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else void el.requestFullscreen?.();
                }}
                title="全屏"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" strokeLinecap="round" />
                </svg>
              </Button>
            </div>
          </div>
        </div>

        <aside className="flex min-h-0 w-[300px] shrink-0 flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-border/70 px-2.5">
            <span className="text-xs font-medium">标注片段</span>
            <span className="tnum text-[10.5px] text-muted-foreground">
              {segments.length} 段 · {total.toFixed(1)}s
            </span>
          </div>

          <div className="shrink-0 border-b border-border/70 p-2.5">
            {markStart !== null && (
              <div className="mb-2 rounded-md bg-muted/60 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 animate-pulse rounded-full bg-foreground" />
                  <span className="text-[0.6875rem] font-medium">正在标记片段</span>
                  <span className="ml-auto tabular-nums text-[0.6875rem] text-muted-foreground">
                    {Math.abs(currentTime - markStart).toFixed(2)}s
                  </span>
                </div>
                <div className="s-timecode mt-1 flex items-center justify-between text-[0.625rem] text-muted-foreground">
                  <span>{timecode(Math.min(markStart, currentTime), fps)}</span>
                  <span>→</span>
                  <span>{timecode(Math.max(markStart, currentTime), fps)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[0.625rem] leading-relaxed text-muted-foreground">
                  移动播放头调整终点，按 <Kbd className="h-4 min-w-4 text-[0.5625rem]">N</Kbd> 确认，
                  <Kbd className="h-4 min-w-4 text-[0.5625rem]">Esc</Kbd> 取消
                </div>
              </div>
            )}

            {selected ? (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">当前片段</span>
                  {task.editable && (
                    <button
                      onClick={() => removeSegment(selected.id)}
                      className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                      title="删除片段"
                    >
                      <IconTrash size={12} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-muted-foreground">起点（秒）</label>
                    <TimeField
                      value={selected.start}
                      disabled={!task.editable}
                      onCommit={(v) => updateSegment(selected.id, { start: Math.min(v, selected.end - 1 / fps) })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-muted-foreground">终点（秒）</label>
                    <TimeField
                      value={selected.end}
                      disabled={!task.editable}
                      onCommit={(v) => updateSegment(selected.id, { end: Math.max(v, selected.start + 1 / fps) })}
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted-foreground">
                  <span className="s-timecode">
                    {timecode(selected.start, fps)} → {timecode(selected.end, fps)}
                  </span>
                  <span className="tnum text-foreground">{(selected.end - selected.start).toFixed(2)}s</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => updateSegment(selected.id, { start: Math.min(currentTime, selected.end - 1 / fps) })}
                    disabled={!task.editable}
                    title="把播放头位置设为起点（I）"
                  >
                    <IconTarget size={11} />
                    起点
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => updateSegment(selected.id, { end: Math.max(currentTime, selected.start + 1 / fps) })}
                    disabled={!task.editable}
                    title="把播放头位置设为终点（O）"
                  >
                    <IconTarget size={11} />
                    终点
                  </Button>
                </div>
                {task.editable && (
                  <input
                    value={selected.label ?? ""}
                    onChange={(e) => updateSegment(selected.id, { label: e.target.value })}
                    placeholder="片段标签（可选）"
                    maxLength={80}
                    className="mt-2 h-7 w-full rounded-sm border border-border bg-input px-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-primary/50"
                  />
                )}
              </>
            ) : markStart === null ? (
              <div className="py-3 text-center text-[11px] text-muted-foreground">
                在时间轴或下方列表中选择一个片段
              </div>
            ) : null}
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {segments.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
                <span className="text-xs text-muted-foreground">还没有标注片段</span>
                <span className="text-[10.5px] leading-relaxed text-muted-foreground/70">
                  在时间轴空白处拖拽，或按 N 新建
                </span>
              </div>
            ) : (
              <div className="p-1.5">
                {segments.map((seg, i) => {
                  const bad = conflicts.has(i);
                  const active = seg.id === selectedId;
                  return (
                    <button
                      key={seg.id}
                      onClick={() => {
                        setSelectedId(seg.id);
                        seek(seg.start);
                      }}
                      className={`mb-1 flex w-full cursor-pointer items-center gap-2 rounded-sm border px-2 py-1.5 text-left transition-colors ${
                        active ? "border-primary/40 bg-primary/10" : "border-transparent hover:bg-accent/60"
                      } ${bad ? "border-destructive/40 bg-destructive/10" : ""}`}
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] text-[9px] ${
                          active ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="s-timecode text-[10.5px]">{clockWithCents(seg.start)}</span>
                      <span className="text-[9px] text-muted-foreground/50">→</span>
                      <span className="s-timecode text-[10.5px]">{clockWithCents(seg.end)}</span>
                      <span className="ml-auto tnum text-[10px] text-muted-foreground">
                        {(seg.end - seg.start).toFixed(1)}s
                      </span>
                      {seg.label && (
                        <span className="max-w-[52px] truncate text-[10px] text-muted-foreground">{seg.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border/70 p-2.5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] text-muted-foreground">有效时长</div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="tnum text-[1.3rem] font-medium leading-none">{total.toFixed(1)}</span>
                  <span className="text-[10.5px] text-muted-foreground">秒</span>
                </div>
              </div>
              <div className="text-right text-[10px] leading-relaxed text-muted-foreground">
                {segments.length} 个片段
                <br />
                {task.submission ? `已提交 v${task.submission.version}` : "未提交不计入"}
              </div>
            </div>
            {conflicts.size > 0 && (
              <div className="mt-2 flex items-start gap-1.5 rounded-sm border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[10.5px] leading-snug text-destructive">
                <IconAlert size={11} className="mt-px shrink-0" />
                {conflicts.size} 个片段重叠，需调整后才能提交
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[9.5px] text-muted-foreground/60">
              <Kbd>空格</Kbd>播放
              <Kbd>←→</Kbd>逐帧
              <Kbd>N</Kbd>打点 / 确认
              <Kbd>S</Kbd>分割
            </div>
            {task.editable && (
              <Button variant="outline" size="sm" className="mt-2 w-full" onClick={toggleMark}>
                {markStart !== null ? <IconCheck size={12} /> : <IconPlus size={12} />}
                {markStart !== null ? "确认片段（N）" : "在播放头处打点（N）"}
              </Button>
            )}
          </div>
        </aside>
      </div>

      <div className="h-[132px] shrink-0 px-2.5 pb-2.5">
        <TimelineEditor
          duration={duration}
          fps={fps}
          segments={segments}
          selectedId={selectedId}
          currentTime={currentTime}
          conflicts={conflicts}
          editable={task.editable}
          markRange={markStart !== null ? { start: markStart, end: currentTime } : null}
          onSeek={seek}
          onChange={setSegments}
          onSelect={setSelectedId}
          onAdd={toggleMark}
          onDelete={() => removeSegment(selectedId)}
          onDuplicate={duplicateSegment}
          onSplit={splitAtPlayhead}
        />
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="确认提交标注"
        desc="提交后版本锁定，片段时长计入提交当天的工作量。"
        width={420}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <span className="spinner" />}
              {submitting ? "提交中…" : "确认提交"}
            </Button>
          </>
        }
      >
        <div className="rounded-sm border border-border bg-accent/25 px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">有效时长</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="tnum text-[1.6rem] font-medium leading-none">{total.toFixed(1)}</span>
            <span className="text-[11px] text-muted-foreground">秒</span>
            <span className="s-timecode ml-2 text-[11px] text-muted-foreground">{timecode(total, fps)}</span>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>片段数量</span>
            <span className="text-foreground">{segments.length} 个</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>提交日期</span>
            <span className="text-foreground">今天</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>提交后</span>
            <span className="text-foreground">需管理员退回才能修改</span>
          </div>
        </div>
        {submitError && (
          <div className="mt-3 flex items-start gap-1.5 rounded-sm border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            <IconAlert size={12} className="mt-px shrink-0" />
            {submitError}
          </div>
        )}
      </Modal>
    </div>
  );
}

function snapshotOf(list: StudioSegment[]): string {
  return JSON.stringify(list.map((s) => [s.start, s.end, s.label ?? null]));
}

function clockWithCents(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function TimeField({
  value,
  onCommit,
  disabled,
}: {
  value: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value.toFixed(2));

  useEffect(() => {
    setText(value.toFixed(2));
  }, [value]);

  return (
    <input
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = Number.parseFloat(text);
        if (Number.isFinite(n) && n >= 0) onCommit(Math.round(n * 1000) / 1000);
        else setText(value.toFixed(2));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="tnum h-7 w-full rounded-sm border border-border bg-input px-2 text-center font-mono text-xs outline-none focus-visible:border-primary/50 disabled:bg-transparent"
      aria-label="时间（秒）"
    />
  );
}
