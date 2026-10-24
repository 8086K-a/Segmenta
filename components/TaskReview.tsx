"use client";

import { useMemo, useRef, useState } from "react";
import { formatClock, formatDateTime } from "@/lib/time";
import { sumDuration } from "@/lib/segment-utils";
import { timecode } from "@/lib/timecode";
import { TimelineEditor, type StudioSegment } from "./studio/TimelineEditor";
import { Badge } from "./ui";
import { IconPause, IconPlay, IconStepBack, IconStepFwd, IconTarget } from "./icons";

export function TaskReview({
  videoId,
  duration,
  segments,
  fps = 30,
}: {
  videoId: string;
  duration: number;
  segments: StudioSegment[];
  fps?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const didInit = useRef(false);
  const [current, setCurrent] = useState(segments[0]?.start ?? 0);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const total = useMemo(() => sumDuration(segments), [segments]);

  function seek(t: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, t));
    setCurrent(v.currentTime);
  }

  return (
    <div className="space-y-3">
      <div className="panel overflow-hidden rounded-sm border">
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            src={`/api/videos/${videoId}/stream`}
            className="absolute inset-0 size-full object-contain"
            preload="metadata"
            playsInline
            onLoadedData={(e) => {
              if (didInit.current) return;
              didInit.current = true;
              const v = e.currentTarget;
              const t = Math.max(0, Math.min(segments[0]?.start ?? 0, (v.duration || 0) - 0.1));
              v.currentTime = t;
              setCurrent(t);
            }}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) void v.play();
              else v.pause();
            }}
          />
        </div>
        <div className="flex h-11 items-center gap-2 border-t px-3">
          <button
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) void v.play();
              else v.pause();
            }}
            className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-foreground text-background"
            aria-label={playing ? "暂停" : "播放"}
          >
            {playing ? <IconPause size={11} /> : <IconPlay size={11} />}
          </button>
          <button
            onClick={() => seek(current - 1 / fps)}
            className="flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="上一帧"
          >
            <IconStepBack size={13} />
          </button>
          <button
            onClick={() => seek(current + 1 / fps)}
            className="flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="下一帧"
          >
            <IconStepFwd size={13} />
          </button>
          <span className="s-timecode text-xs text-foreground">{timecode(current, fps)}</span>
          <span className="text-[11px] text-muted-foreground/50">/</span>
          <span className="s-timecode text-[11px] text-muted-foreground">{timecode(duration, fps)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, duration)}
            step={1 / fps}
            value={current}
            onChange={(e) => seek(Number(e.target.value))}
            className="ml-2 h-1 flex-1 cursor-pointer accent-[hsl(200_90%_52%)]"
            aria-label="进度"
          />
        </div>
      </div>

      <div className="h-[152px]">
        <TimelineEditor
          duration={duration}
          fps={fps}
          segments={segments}
          selectedId={selectedId}
          currentTime={current}
          conflicts={new Set()}
          editable={false}
          onSeek={seek}
          onChange={() => {}}
          onSelect={setSelectedId}
          onAdd={() => {}}
          onDelete={() => {}}
          onDuplicate={() => {}}
          onSplit={() => {}}
        />
      </div>

      <div className="rounded-sm border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium">片段列表</span>
          <span className="text-[11px] text-muted-foreground">
            {segments.length} 段 · <span className="tnum">{total.toFixed(1)}</span> 秒
          </span>
        </div>
        <div className="divide-y divide-border/60">
          {segments.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2">
              <span className="flex size-4 items-center justify-center rounded-[3px] bg-accent text-[9px] text-muted-foreground">
                {i + 1}
              </span>
              <span className="s-timecode text-xs">
                {s.start.toFixed(2)}s <span className="text-muted-foreground/50">→</span> {s.end.toFixed(2)}s
              </span>
              <span className="tnum text-[11px] text-muted-foreground">{(s.end - s.start).toFixed(2)}s</span>
              <span className="truncate text-xs text-muted-foreground">{s.label || "—"}</span>
              <button
                onClick={() => seek(s.start)}
                className="ml-auto flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
              >
                <IconTarget size={11} />
                定位
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SubmissionHistory({
  history,
}: {
  history: {
    id: string;
    version: number;
    submitted_at: string;
    total_duration: number;
    segment_count: number;
    is_current: number;
    submitted_by_name: string;
  }[];
}) {
  if (history.length === 0) return null;
  return (
    <div className="rounded-lg bg-card ring-1 ring-foreground/10 p-4">
      <div className="mb-2.5 text-sm font-medium">提交版本</div>
      <div className="space-y-1.5">
        {history.map((h) => (
          <div key={h.id} className="flex items-center gap-2 rounded-sm border border-border px-2.5 py-2 text-[11.5px]">
            <Badge tone={h.is_current ? "success" : "muted"}>v{h.version}</Badge>
            <span className="text-muted-foreground">{h.submitted_by_name}</span>
            <span className="ml-auto tnum">{h.total_duration.toFixed(1)}s</span>
            <span className="tnum text-muted-foreground">{formatDateTime(h.submitted_at)}</span>
            {!h.is_current && <span className="text-[10px] text-muted-foreground/60">已作废</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function durationLabel(seconds: number): string {
  return formatClock(seconds);
}
