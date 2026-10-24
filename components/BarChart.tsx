type Datum = { label: string; value: number; sub?: string; highlight?: boolean };

/** 纯 CSS 柱状图：不依赖图表库，服务端可直接渲染，hover 显示数值 */
export function BarChart({
  data,
  height = 168,
  labelEvery = 1,
  unit = "秒",
}: {
  data: Datum[];
  height?: number;
  labelEvery?: number;
  unit?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <div className="flex items-end gap-[4px]" style={{ height }}>
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(3, (d.value / max) * 100) : 1.5;
          return (
            <div key={`${d.label}-${i}`} className="group relative flex h-full flex-1 flex-col justify-end">
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-sm border border-border bg-popover px-2 py-1 text-[10.5px] leading-tight shadow-lg group-hover:block">
                <div className="tnum font-medium">
                  {d.value > 0 ? `${Math.round(d.value * 10) / 10} ${unit}` : "无提交"}
                </div>
                {d.sub && <div className="text-[9.5px] text-muted-foreground">{d.sub}</div>}
              </div>
              <div
                className="w-full rounded-[2px] transition-colors duration-150"
                style={{
                  height: `${h}%`,
                  background: d.highlight
                    ? "var(--foreground)"
                    : d.value > 0
                      ? "color-mix(in oklch, var(--foreground) 22%, transparent)"
                      : "var(--muted)",
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-[4px] border-t border-border pt-1.5">
        {data.map((d, i) => (
          <div key={`${d.label}-l-${i}`} className="flex-1 overflow-visible text-center">
            <span className="text-[9.5px] text-muted-foreground">
              {i % labelEvery === 0 || d.highlight ? d.label : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted-foreground">
        <span>合计 {Math.round(total)} 秒</span>
        <span>峰值 {Math.round(max)} 秒</span>
      </div>
    </div>
  );
}
