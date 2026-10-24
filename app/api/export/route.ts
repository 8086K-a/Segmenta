import { canAccessTenant, tenantScope } from "@/lib/auth";
import { fail, requireAdmin } from "@/lib/api";
import { getDb } from "@/lib/db";
import { addDays, formatClock, todayBizDate } from "@/lib/time";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 导出已提交任务的有效片段 / 汇总，带 BOM 以便 Excel 正确识别中文 */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    const url = new URL(req.url);
    const to = url.searchParams.get("to") || todayBizDate();
    const from = url.searchParams.get("from") || addDays(to, -29);
    const tenantId = url.searchParams.get("tenantId");
    const type = url.searchParams.get("type") === "segments" ? "segments" : "tasks";

    const tenantIds = tenantId && canAccessTenant(admin, tenantId) ? [tenantId] : tenantScope(admin);
    const db = getDb();
    const placeholders = tenantIds.map(() => "?").join(",");

    let header: string[];
    let rows: unknown[][];

    if (type === "segments") {
      header = ["提交日期", "提交时间", "租户", "任务", "标注员", "片段序号", "开始(秒)", "结束(秒)", "时长(秒)", "标签"];
      const data = db
        .prepare(
          `SELECT s.submitted_date, s.submitted_at, ten.name AS tenant_name, t.title, u.name AS annotator,
                  s.segments_json
             FROM submissions s
             JOIN tasks t ON t.id = s.task_id
             JOIN tenants ten ON ten.id = t.tenant_id
             JOIN users u ON u.id = s.submitted_by
            WHERE s.is_current = 1 AND t.tenant_id IN (${placeholders})
              AND s.submitted_date >= ? AND s.submitted_date <= ?
            ORDER BY s.submitted_at DESC`,
        )
        .all(...tenantIds, from, to) as {
        submitted_date: string;
        submitted_at: string;
        tenant_name: string;
        title: string;
        annotator: string;
        segments_json: string;
      }[];

      rows = [];
      for (const row of data) {
        const segs = JSON.parse(row.segments_json) as { start: number; end: number; label?: string | null }[];
        segs.forEach((s, i) => {
          rows.push([
            row.submitted_date,
            row.submitted_at,
            row.tenant_name,
            row.title,
            row.annotator,
            i + 1,
            s.start.toFixed(3),
            s.end.toFixed(3),
            (s.end - s.start).toFixed(3),
            s.label ?? "",
          ]);
        });
      }
    } else {
      header = ["提交日期", "提交时间", "租户", "任务", "标注员", "版本", "片段数", "有效时长(秒)", "有效时长"];
      rows = (
        db
          .prepare(
            `SELECT s.submitted_date, s.submitted_at, ten.name AS tenant_name, t.title, u.name AS annotator,
                    s.version, s.segment_count, s.total_duration
               FROM submissions s
               JOIN tasks t ON t.id = s.task_id
               JOIN tenants ten ON ten.id = t.tenant_id
               JOIN users u ON u.id = s.submitted_by
              WHERE s.is_current = 1 AND t.tenant_id IN (${placeholders})
                AND s.submitted_date >= ? AND s.submitted_date <= ?
              ORDER BY s.submitted_date, s.submitted_at`,
          )
          .all(...tenantIds, from, to) as {
          submitted_date: string;
          submitted_at: string;
          tenant_name: string;
          title: string;
          annotator: string;
          version: number;
          segment_count: number;
          total_duration: number;
        }[]
      ).map((r) => [
        r.submitted_date,
        r.submitted_at,
        r.tenant_name,
        r.title,
        r.annotator,
        `v${r.version}`,
        r.segment_count,
        r.total_duration.toFixed(3),
        formatClock(r.total_duration),
      ]);
    }

    const csv = "\uFEFF" + [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
    const filename = `segmenta-${type}-${from}_${to}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
