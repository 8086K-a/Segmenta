export const FPS_PRESETS = [23.976, 24, 25, 29.97, 30, 50, 60];

export function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, "0");
}

/** 秒 → HH:MM:SS:FF */
export function timecode(seconds: number, fps: number): string {
  const t = Math.max(0, seconds || 0);
  const totalFrames = Math.round(t * fps);
  const f = totalFrames % Math.round(fps);
  const totalSeconds = Math.floor(totalFrames / fps);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}:${pad2(f)}`;
}

/** 秒 → MM:SS */
export function shortTime(seconds: number): string {
  const t = Math.max(0, seconds || 0);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${pad2(m)}:${pad2(s)}`;
}

export function frameIndex(seconds: number, fps: number): number {
  return Math.round(Math.max(0, seconds) * fps);
}

export function snapToFrame(seconds: number, fps: number): number {
  return Math.round(seconds * fps) / fps;
}

export function frameDuration(fps: number): number {
  return 1 / fps;
}

/** 常用帧率对齐（检测结果接近标准值时取标准值） */
export function normalizeFps(raw: number): number {
  const presets = [23.976, 24, 25, 29.97, 30, 50, 60];
  let best = 30;
  let bestDiff = Infinity;
  for (const p of presets) {
    const diff = Math.abs(p - raw);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p;
    }
  }
  return bestDiff < 1.2 ? best : Math.round(raw * 100) / 100;
}
