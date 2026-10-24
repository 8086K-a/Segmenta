import { canAccessTenant, tenantScope } from "@/lib/auth";
import { fail, json, requireAdmin } from "@/lib/api";
import { annotatorStats, dailyStats, taskStats } from "@/lib/queries";
import { addDays, dateRange, todayBizDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    const url = new URL(req.url);
    const to = url.searchParams.get("to") || todayBizDate();
    const from = url.searchParams.get("from") || addDays(to, -13);
    const tenantId = url.searchParams.get("tenantId");
    const annotatorId = url.searchParams.get("annotatorId");

    const tenantIds = tenantId && canAccessTenant(admin, tenantId) ? [tenantId] : tenantScope(admin);

    const days = dailyStats({ tenantIds, from, to, annotatorId });
    const map = new Map(days.map((d) => [d.day, d]));
    const series = dateRange(from, to).map((day) => ({
      day,
      seconds: map.get(day)?.seconds ?? 0,
      tasks: map.get(day)?.tasks ?? 0,
      segments: map.get(day)?.segments ?? 0,
    }));

    return json({
      series,
      total: Math.round(series.reduce((s, d) => s + d.seconds, 0) * 1000) / 1000,
      taskTotal: series.reduce((s, d) => s + d.tasks, 0),
      annotators: annotatorStats(tenantIds, from, to),
      tasks: taskStats(tenantIds, from, to, annotatorId),
    });
  } catch (error) {
    return fail(error);
  }
}
