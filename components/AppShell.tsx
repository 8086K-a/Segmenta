"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/types";
import {
  IconChart,
  IconCheck,
  IconFilm,
  IconGrid,
  IconInbox,
  IconLayers,
  IconList,
  IconLogout,
  IconUsers,
} from "./icons";
import { Avatar } from "./ui";
import { ThemeToggle } from "./theme";

const ADMIN_NAV = [
  { href: "/dashboard", label: "概览", icon: IconGrid },
  { href: "/tasks", label: "任务", icon: IconList },
  { href: "/studio", label: "工作台", icon: IconLayers },
  { href: "/stats", label: "统计", icon: IconChart },
  { href: "/team", label: "团队", icon: IconUsers },
  { href: "/videos", label: "视频库", icon: IconFilm },
];

const ANNOTATOR_NAV = [
  { href: "/studio", label: "工作台", icon: IconLayers },
  { href: "/hall", label: "任务大厅", icon: IconInbox },
  { href: "/my-tasks", label: "我的任务", icon: IconCheck },
];

const ROLE_TEXT: Record<string, string> = {
  SUPER_ADMIN: "平台管理员",
  ADMIN: "租户管理员",
  ANNOTATOR: "标注员",
};

export function Logo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="1.5" y="3" width="9" height="3.4" rx="1.7" fill="currentColor" opacity="0.6" />
      <rect x="5.5" y="8.3" width="13" height="3.4" rx="1.7" fill="currentColor" />
      <rect x="1.5" y="13.6" width="6" height="3.4" rx="1.7" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const nav = user.role === "ANNOTATOR" ? ANNOTATOR_NAV : ADMIN_NAV;

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-1 border-b border-border/60 bg-background/85 px-3 backdrop-blur-md">
        <Link
          href={nav[0].href}
          className="flex shrink-0 items-center gap-1.5 rounded-md py-1 pr-1.5 pl-1 transition-colors hover:bg-muted"
        >
          <span className="flex size-6 items-center justify-center rounded-[7px] bg-primary text-primary-foreground">
            <Logo size={13} />
          </span>
          <span className="text-xs font-medium">Segmenta</span>
        </Link>

        <span className="mx-1 h-4 w-px bg-border" />

        <nav className="scrollbar-hidden flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <span className="hidden items-center gap-1.5 rounded-md border border-border/70 px-1.5 py-0.5 text-[0.625rem] text-muted-foreground sm:flex">
            <span className="size-1 rounded-full bg-success" />
            {user.tenantName}
          </span>
          <ThemeToggle />
          <div className="flex items-center gap-1.5 pl-1">
            <Avatar name={user.name} size={22} />
            <div className="hidden leading-tight sm:block">
              <div className="text-[0.6875rem] font-medium">{user.name}</div>
              <div className="text-[0.625rem] text-muted-foreground">{ROLE_TEXT[user.role]}</div>
            </div>
          </div>
          <button
            onClick={logout}
            disabled={loggingOut}
            title="退出登录"
            aria-label="退出登录"
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <IconLogout size={13} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
