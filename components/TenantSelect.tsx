"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "./ui";

export function TenantSelect({
  tenants,
  value,
}: {
  tenants: { id: string; name: string }[];
  value: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <Select
      className="w-auto min-w-[140px]"
      value={value ?? ""}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set("tenantId", e.target.value);
        else next.delete("tenantId");
        router.replace(`${pathname}?${next.toString()}`);
      }}
      aria-label="切换租户"
    >
      <option value="">全部租户</option>
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
  );
}
