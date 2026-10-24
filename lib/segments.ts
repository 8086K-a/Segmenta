import { ApiError } from "./api";
import { MIN_SEGMENT, findOverlaps, round3, sumDuration } from "./segment-utils";

export type InputSegment = {
  id?: string;
  start: number;
  end: number;
  label?: string | null;
};

export type NormalizedSegment = {
  id?: string;
  start: number;
  end: number;
  label: string | null;
};

export type SegmentIssue = {
  index: number;
  code: "OVERLAP" | "OUT_OF_RANGE" | "NEGATIVE" | "EMPTY" | "TOO_SHORT" | "INVALID";
  message: string;
};

const MAX_SEGMENTS = 500;
const EPS = 1e-6;

/**
 * 校验并规范化片段列表。
 * 规则：
 *  - 起止必须是有限数字，且 0 <= start < end <= 视频时长
 *  - 单个片段不短于 0.1 秒
 *  - 同一任务内片段不得重叠（左闭右开，[10,20] 与 [20,30] 视为相邻）
 */
export function normalizeSegments(raw: unknown, duration: number | null): NormalizedSegment[] {
  if (!Array.isArray(raw)) {
    throw new ApiError(422, "segments 必须是数组", "VALIDATION");
  }
  if (raw.length > MAX_SEGMENTS) {
    throw new ApiError(422, `单个任务最多 ${MAX_SEGMENTS} 个片段`, "VALIDATION");
  }

  const issues: SegmentIssue[] = [];
  const list: NormalizedSegment[] = [];

  raw.forEach((item, index) => {
    const seg = item as Partial<InputSegment> | null;
    const start = typeof seg?.start === "number" ? seg.start : Number.NaN;
    const end = typeof seg?.end === "number" ? seg.end : Number.NaN;

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      issues.push({ index, code: "INVALID", message: `第 ${index + 1} 个片段的起止时间不是有效数字` });
      return;
    }

    const s = round3(start);
    const e = round3(end);

    if (s < 0) {
      issues.push({ index, code: "NEGATIVE", message: `第 ${index + 1} 个片段起点不能小于 0 秒` });
      return;
    }
    if (e <= s) {
      issues.push({ index, code: "EMPTY", message: `第 ${index + 1} 个片段结束时间必须大于开始时间` });
      return;
    }
    if (e - s < MIN_SEGMENT - EPS) {
      issues.push({ index, code: "TOO_SHORT", message: `第 ${index + 1} 个片段不能短于 ${MIN_SEGMENT} 秒` });
      return;
    }
    if (duration != null && e > duration + 0.05) {
      issues.push({
        index,
        code: "OUT_OF_RANGE",
        message: `第 ${index + 1} 个片段超出视频时长（${duration.toFixed(1)} 秒）`,
      });
      return;
    }

    list.push({
      id: typeof seg?.id === "string" ? seg.id : undefined,
      start: s,
      end: e,
      label: typeof seg?.label === "string" && seg.label.trim() ? seg.label.trim().slice(0, 80) : null,
    });
  });

  if (issues.length > 0) {
    throw new ApiError(422, issues[0].message, "SEGMENT_INVALID", { issues });
  }

  const sorted = [...list].sort((a, b) => a.start - b.start || a.end - b.end);
  const conflicts = findOverlaps(sorted);
  if (conflicts.size > 0) {
    const i = [...conflicts][0];
    const message = `片段 ${sorted[i].start.toFixed(1)}s–${sorted[i].end.toFixed(1)}s 与相邻片段重叠`;
    throw new ApiError(422, message, "SEGMENT_OVERLAP", {
      issues: [...conflicts].map((idx) => ({ index: idx, code: "OVERLAP" as const, message })),
    });
  }

  return sorted;
}

export function totalDuration(segments: { start: number; end: number }[]): number {
  return sumDuration(segments);
}
