export const BIZ_TZ = process.env.BIZ_TZ || "Asia/Shanghai";

/** 当前时间的 ISO 字符串（UTC） */
export function nowIso(): string {
  return new Date().toISOString();
}

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BIZ_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 把 ISO 时间转换为业务时区下的 YYYY-MM-DD，用于按“提交日”分组 */
export function bizDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return dateFmt.format(d);
}

export function todayBizDate(): string {
  return bizDate(new Date());
}

/** 业务时区下某个日期字符串（YYYY-MM-DD）对应的星期几，0=周日 */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/** 生成从 from 到 to 的连续日期数组 */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = start.getTime(); d <= end.getTime(); d += 86400000) {
    out.push(new Date(d).toISOString().slice(0, 10));
  }
  return out;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 秒 → 01:23.4（标注场景用） */
export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds || 0);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${String(m).padStart(2, "0")}:${rest.toFixed(1).padStart(4, "0")}`;
}

/** 秒 → 1分23秒 / 45秒 */
export function formatHuman(seconds: number): string {
  const s = Math.round(seconds || 0);
  if (s < 60) return `${s} 秒`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} 小时 ${m} 分`;
  return sec === 0 ? `${m} 分钟` : `${m} 分 ${sec} 秒`;
}

/** 秒 → 时长主体数字 + 单位，用于大数字展示 */
export function splitDuration(seconds: number): { value: string; unit: string } {
  const s = Math.round(seconds || 0);
  if (s >= 3600) return { value: (s / 3600).toFixed(1), unit: "小时" };
  if (s >= 60) return { value: (s / 60).toFixed(1), unit: "分钟" };
  return { value: String(s), unit: "秒" };
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: BIZ_TZ,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const wd = ["日", "一", "二", "三", "四", "五", "六"][d.getUTCDay()];
  return `${dateStr.slice(5).replace("-", "/")} 周${wd}`;
}
