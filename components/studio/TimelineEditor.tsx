"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { snapToFrame } from "@/lib/timecode";
import { Button } from "@/components/ui";
import {
  IconCheck,
  IconCopy,
  IconMagnet,
  IconPlus,
  IconScissorsLine,
  IconTrash,
  IconZoomIn,
  IconZoomOut,
} from "@/components/icons";

export type StudioSegment = { id: string; start: number; end: number; label?: string | null };

const MIN_PPS = 1;
const MAX_PPS = 800;
const RULER_H = 22;
const TRACK_H = 64;

const TICK_STEPS = [1 / 30, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function TimelineEditor({
  duration,
  fps,
  segments,
  selectedId,
  currentTime,
  conflicts,
  editable,
  markRange,
  onSeek,
  onChange,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
  onSplit,
}: {
  duration: number;
  fps: number;
  segments: StudioSegment[];
  selectedId: string | null;
  currentTime: number;
  conflicts: Set<number>;
  editable: boolean;
  markRange?: { start: number; end: number } | null;
  onSeek: (t: number) => void;
  onChange: (next: StudioSegment[]) => void;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoomState, setZoomState] = useState<number | null>(null);
  const [snapping, setSnapping] = useState(true);
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  const draftRef = useRef<{ start: number; end: number } | null>(null);
  const dragRef = useRef<
    | { mode: "create"; anchor: number }
    | { mode: "move"; id: string; grab: number; len: number }
    | { mode: "resize-l"; id: string }
    | { mode: "resize-r"; id: string }
    | null
  >(null);

  const minPps = useMemo(() => {
    if (duration <= 0) return 12;
    return clamp(viewportWidth / duration, MIN_PPS, MAX_PPS);
  }, [duration, viewportWidth]);

  // 长视频默认视野约 2 分钟；短视频则整段铺满
  const initialZoom = useMemo(() => {
    if (!viewportWidth || duration <= 0) return 0;
    const targetWindow = Math.min(duration, 120);
    const desiredPps = viewportWidth / targetWindow;
    const z = Math.log(desiredPps / minPps) / Math.log(MAX_PPS / minPps);
    return clamp(z, 0, 1);
  }, [viewportWidth, duration, minPps]);

  const zoom = zoomState ?? initialZoom;
  const setZoom = useCallback(
    (next: number | ((z: number) => number)) => {
      setZoomState((cur) => {
        const base = cur ?? initialZoom;
        return clamp(typeof next === "function" ? next(base) : next, 0, 1);
      });
    },
    [initialZoom],
  );

  const pps = useMemo(() => minPps * Math.pow(MAX_PPS / minPps, zoom), [minPps, zoom]);
  const contentWidth = Math.max(viewportWidth, duration * pps + 40);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setViewportWidth(entries[0].contentRect.width));
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => clamp(z + (e.deltaY < 0 ? 0.08 : -0.08), 0, 1));
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const prevPps = useRef(pps);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevPps.current !== pps) {
      const anchor = currentTime * pps;
      el.scrollLeft = clamp(anchor - el.clientWidth * 0.4, 0, Math.max(0, contentWidth - el.clientWidth));
      prevPps.current = pps;
    }
  }, [pps, currentTime, contentWidth]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const x = currentTime * pps;
    if (x < el.scrollLeft + 30 || x > el.scrollLeft + el.clientWidth - 60) {
      el.scrollLeft = clamp(x - el.clientWidth * 0.35, 0, Math.max(0, contentWidth - el.clientWidth));
    }
  }, [currentTime, pps, contentWidth]);

  const toTime = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      return clamp((clientX - rect.left) / pps, 0, duration);
    },
    [duration, pps],
  );

  const snap = useCallback(
    (t: number) => {
      let v = snapToFrame(clamp(t, 0, duration), fps);
      if (snapping) {
        const candidates = [0, duration, ...segments.flatMap((s) => [s.start, s.end])];
        for (const c of candidates) {
          if (Math.abs(c - v) * pps < 7) {
            v = c;
            break;
          }
        }
      }
      return Math.round(v * 1000) / 1000;
    },
    [duration, fps, pps, segments, snapping],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const t = toTime(e.clientX);

      if (drag.mode === "create") {
        const d = { start: Math.min(drag.anchor, t), end: Math.max(drag.anchor, t) };
        draftRef.current = d;
        setDraft(d);
        return;
      }
      if (drag.mode === "move") {
        const start = clamp(snap(t - drag.grab), 0, Math.max(0, duration - drag.len));
        const end = Math.min(duration, start + drag.len);
        onChange(segments.map((s) => (s.id === drag.id ? { ...s, start, end } : s)));
        return;
      }
      if (drag.mode === "resize-l") {
        onChange(segments.map((s) => (s.id === drag.id ? { ...s, start: Math.min(snap(t), s.end - 1 / fps) } : s)));
        return;
      }
      if (drag.mode === "resize-r") {
        onChange(segments.map((s) => (s.id === drag.id ? { ...s, end: Math.max(snap(t), s.start + 1 / fps) } : s)));
      }
    }

    function onUp() {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      if (drag.mode === "create") {
        const d = draftRef.current;
        draftRef.current = null;
        setDraft(null);
        if (d) {
          const start = snap(d.start);
          const end = snap(d.end);
          if (end - start >= 1 / fps) {
            const seg: StudioSegment = {
              id: `seg_${Math.random().toString(36).slice(2, 10)}`,
              start,
              end,
              label: null,
            };
            onChange([...segments, seg].sort((a, b) => a.start - b.start));
            onSelect(seg.id);
          } else {
            onSeek(start);
          }
        }
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [duration, fps, onChange, onSeek, onSelect, segments, snap, toTime]);

  function startScrub(e: React.PointerEvent) {
    if (e.button !== 0) return;
    onSeek(snap(toTime(e.clientX)));
    const onMove = (ev: PointerEvent) => onSeek(snap(toTime(ev.clientX)));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startCreate(e: React.PointerEvent) {
    if (!editable || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-clip]")) return;
    const t = snap(toTime(e.clientX));
    onSelect(null);
    onSeek(t);
    dragRef.current = { mode: "create", anchor: t };
    draftRef.current = { start: t, end: t };
    setDraft({ start: t, end: t });
  }

  function startClip(e: React.PointerEvent, seg: StudioSegment) {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(seg.id);
    const t = toTime(e.clientX);
    onSeek(t);
    if (!editable) return;
    const handle = (e.target as HTMLElement).dataset.handle;
    if (handle === "l") dragRef.current = { mode: "resize-l", id: seg.id };
    else if (handle === "r") dragRef.current = { mode: "resize-r", id: seg.id };
    else
      dragRef.current = {
        mode: "move",
        id: seg.id,
        grab: t - seg.start,
        len: seg.end - seg.start,
      };
  }

  const { tickStep, labelStep } = useMemo(() => {
    const tick = TICK_STEPS.find((s) => s * pps >= 7) ?? 600;
    const label = TICK_STEPS.find((s) => s >= tick && s * pps >= 64) ?? tick * 5;
    return { tickStep: tick, labelStep: label };
  }, [pps]);

  const ticks = useMemo(() => {
    if (duration <= 0) return [] as { t: number; major: boolean }[];
    const startT = Math.floor(scrollLeft / pps / tickStep) * tickStep;
    const endT = Math.min(duration + tickStep, (scrollLeft + viewportWidth) / pps + tickStep);
    const out: { t: number; major: boolean }[] = [];
    for (let t = Math.max(0, startT); t <= endT; t += tickStep) {
      const rounded = Math.round(t * 1000) / 1000;
      const major = Math.abs(rounded / labelStep - Math.round(rounded / labelStep)) < 0.001;
      out.push({ t: rounded, major });
    }
    return out;
  }, [duration, labelStep, pps, scrollLeft, tickStep, viewportWidth]);

  function tickLabel(t: number) {
    if (labelStep < 1) return `${t.toFixed(2)}s`;
    const m = Math.floor(t / 60);
    const s = Math.round(t % 60);
    if (duration >= 60) return `${m}:${String(s).padStart(2, "0")}`;
    return `${Math.round(t)}s`;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
      {/* 工具栏 */}
      <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-border/70 px-1.5">
        <Button variant="ghost" size="icon" onClick={onSplit} disabled={!editable} title="在播放头处分割（S）">
          <IconScissorsLine size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDuplicate}
          disabled={!editable || !selectedId}
          title="复制片段"
        >
          <IconCopy size={13} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={!editable || !selectedId}
          title="删除片段（⌫）"
        >
          <IconTrash size={13} />
        </Button>

        <div className="mx-1 h-4 w-px bg-border" />

        <Button
          variant={snapping ? "secondary" : "ghost"}
          size="icon"
          onClick={() => setSnapping((v) => !v)}
          title="吸附到相邻片段与帧"
        >
          <IconMagnet size={13} />
        </Button>

        <div className="mx-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-accent/50 px-2 py-1">
            <span className="size-2 rounded-[2px] bg-primary" />
            片段轨道
          </span>
          <span className="tnum text-muted-foreground/70">{segments.length} 个片段</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onAdd}
          disabled={!editable}
          title={markRange ? "确认片段（N）" : "在播放头处打点（N）"}
        >
          {markRange ? <IconCheck size={12} /> : <IconPlus size={12} />}
          {markRange ? "确认" : "打点"}
        </Button>

        <div className="mx-1 h-4 w-px bg-border" />

        <Button variant="ghost" size="icon" onClick={() => setZoom((z) => clamp(z - 0.1, 0, 1))} title="缩小">
          <IconZoomOut size={13} />
        </Button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-1 w-[88px] cursor-pointer accent-[hsl(200_90%_52%)]"
          aria-label="时间轴缩放"
        />
        <Button variant="ghost" size="icon" onClick={() => setZoom((z) => clamp(z + 0.1, 0, 1))} title="放大">
          <IconZoomIn size={13} />
        </Button>
      </div>

      {/* 轨道区 */}
      <div className="flex min-h-0 flex-1">
        <div className="w-[104px] shrink-0 border-r border-border/70">
          <div className="border-b" style={{ height: RULER_H }} />
          <div className="flex items-center gap-1.5 px-2.5" style={{ height: TRACK_H }}>
            <span className="size-2.5 rounded-[2px] bg-primary" />
            <span className="text-[11px] text-muted-foreground">片段</span>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="scrollbar-thin relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
          onScroll={(e) => setScrollLeft((e.target as HTMLDivElement).scrollLeft)}
        >
          <div style={{ width: contentWidth }} className="relative">
            <div className="s-ruler" style={{ width: contentWidth }} onPointerDown={startScrub}>
              {ticks.map(({ t, major }) => (
                <div key={t}>
                  <div className="s-ruler-tick" style={{ left: t * pps, height: major ? 7 : 4 }} />
                  {major && (
                    <div className="s-ruler-label" style={{ left: t * pps }}>
                      {tickLabel(t)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div
              ref={trackRef}
              className="s-track"
              style={{
                width: contentWidth,
                cursor: editable ? "crosshair" : "default",
                backgroundImage: "linear-gradient(90deg, color-mix(in oklch, var(--foreground) 5%, transparent) 0 1px, transparent 1px)",
                backgroundSize: `${Math.max(8, pps)}px 100%`,
              }}
              onPointerDown={startCreate}
            >
              {segments.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground/60">
                  {editable ? "在此拖拽创建第一个标注片段" : "没有标注片段"}
                </div>
              )}

              {segments.map((seg, i) => {
                const left = seg.start * pps;
                const width = Math.max(3, (seg.end - seg.start) * pps);
                const selected = seg.id === selectedId;
                const conflict = conflicts.has(i);
                return (
                  <div
                    key={seg.id}
                    data-clip
                    className={`s-clip ${selected ? "is-selected" : ""} ${conflict ? "is-conflict" : ""}`}
                    style={{ left, width }}
                    onPointerDown={(e) => startClip(e, seg)}
                    title={`${seg.start.toFixed(2)}s – ${seg.end.toFixed(2)}s`}
                  >
                    {editable && <span className="s-clip-handle left" data-handle="l" />}
                    <span className="pointer-events-none truncate">{seg.label || `${i + 1}`}</span>
                    {editable && <span className="s-clip-handle right" data-handle="r" />}
                  </div>
                );
              })}

              {markRange && (
                <div
                  className="pointer-events-none absolute top-[4px] bottom-[4px] z-[4] flex items-center justify-center overflow-hidden rounded-sm border border-dashed border-foreground/60 bg-foreground/10"
                  style={{
                    left: Math.min(markRange.start, markRange.end) * pps,
                    width: Math.max(2, Math.abs(markRange.end - markRange.start) * pps),
                  }}
                >
                  <span className="truncate px-1 text-[0.625rem] font-medium text-foreground/70">
                    {Math.abs(markRange.end - markRange.start).toFixed(1)}s
                  </span>
                </div>
              )}

              {markRange && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px bg-foreground/45"
                  style={{ left: Math.min(markRange.start, markRange.end) * pps }}
                />
              )}

              {draft && (
                <div
                  className="pointer-events-none absolute top-[5px] bottom-[5px] rounded-sm border border-primary/70 bg-primary/30"
                  style={{
                    left: Math.min(draft.start, draft.end) * pps,
                    width: Math.max(2, Math.abs(draft.end - draft.start) * pps),
                  }}
                />
              )}
            </div>

            <div className="s-playhead" style={{ left: currentTime * pps, height: RULER_H + TRACK_H }} />
          </div>
        </div>
      </div>
    </div>
  );
}
