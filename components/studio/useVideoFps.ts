"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeFps } from "@/lib/timecode";

/**
 * 通过 requestVideoFrameCallback 采样帧间隔来推断视频帧率。
 * 浏览器没有直接的 fps API；播放几帧后取中位数即可稳定。
 */
export function useVideoFps(videoRef: React.RefObject<HTMLVideoElement | null>, playing: boolean) {
  const [fps, setFps] = useState(30);
  const [detected, setDetected] = useState<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  const lastRef = useRef<number>(0);
  const manualRef = useRef(false);

  useEffect(() => {
    if (manualRef.current || !playing) return;
    const video = videoRef.current as
      | (HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
        })
      | null;
    if (!video || typeof video.requestVideoFrameCallback !== "function") return;

    let cancelled = false;

    const onFrame = (_now: number, meta: { mediaTime: number }) => {
      if (cancelled) return;
      const last = lastRef.current;
      if (last > 0) {
        const delta = meta.mediaTime - last;
        if (delta > 0.001 && delta < 0.2) {
          samplesRef.current.push(delta);
        }
      }
      lastRef.current = meta.mediaTime;

      if (samplesRef.current.length >= 24) {
        const sorted = [...samplesRef.current].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const raw = 1 / median;
        const normalized = normalizeFps(raw);
        setDetected(normalized);
        setFps(normalized);
        samplesRef.current = [];
        return;
      }
      video.requestVideoFrameCallback?.(onFrame);
    };

    video.requestVideoFrameCallback(onFrame);

    return () => {
      cancelled = true;
    };
  }, [playing, videoRef]);

  function setManual(value: number) {
    manualRef.current = true;
    setDetected(value);
    setFps(value);
  }

  return { fps, detected, setManual };
}
