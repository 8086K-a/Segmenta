"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input, Select } from "./ui";

export function StatsFilters({
  from,
  to,
  annotatorId,
  annotators,
}: {
  from: string;
  to: string;
  annotatorId: string | null;
  annotators: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [range, setRange] = useState({ from, to });

  function push(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-2">
      <Input
        type="date"
        className="h-7 w-[132px]"
        value={range.from}
        max={range.to}
        onChange={(e) => {
          setRange((r) => ({ ...r, from: e.target.value }));
          push({ from: e.target.value });
        }}
      />
      <span className="text-xs text-muted-foreground">至</span>
      <Input
        type="date"
        className="h-7 w-[132px]"
        value={range.to}
        min={range.from}
        onChange={(e) => {
          setRange((r) => ({ ...r, to: e.target.value }));
          push({ to: e.target.value });
        }}
      />
      <Select
        className="h-7 w-[136px]"
        value={annotatorId ?? ""}
        onChange={(e) => push({ annotatorId: e.target.value || undefined })}
      >
        <option value="">全部标注员</option>
        {annotators.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      {annotatorId && (
        <button
          onClick={() => push({ annotatorId: undefined })}
          className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          清除
        </button>
      )}
    </div>
  );
}
