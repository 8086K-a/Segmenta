export const MIN_SEGMENT = 0.1;
const EPS = 1e-6;

export const round3 = (n: number) => Math.round(n * 1000) / 1000;
export const round1 = (n: number) => Math.round(n * 10) / 10;

export type Range = { start: number; end: number };

/** 返回存在重叠的片段索引集合（左闭右开，[10,20] 与 [20,30] 视为相邻） */
export function findOverlaps(segments: Range[]): Set<number> {
  const conflicts = new Set<number>();
  const idx = segments.map((s, i) => ({ ...s, i })).sort((a, b) => a.start - b.start);
  for (let k = 1; k < idx.length; k++) {
    if (idx[k].start < idx[k - 1].end - EPS) {
      conflicts.add(idx[k].i);
      conflicts.add(idx[k - 1].i);
    }
  }
  return conflicts;
}

export function sumDuration(segments: Range[]): number {
  return round3(segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0));
}

export function formatRange(seg: Range): string {
  return `${seg.start.toFixed(1)}s–${seg.end.toFixed(1)}s`;
}
