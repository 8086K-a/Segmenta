"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./shadcn/button";
import { Input as SInput } from "./shadcn/input";
import { Textarea as STextarea } from "./shadcn/textarea";
import { Label as SLabel } from "./shadcn/label";
import { Badge as SBadge } from "./shadcn/badge";
import { Card as SCard } from "./shadcn/card";
import { NativeSelect } from "./shadcn/native-select";
import { Avatar as SAvatar, AvatarFallback } from "./shadcn/avatar";
import { Separator } from "./shadcn/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./shadcn/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./shadcn/empty";
import type { ReviewStatus, TaskStatus } from "@/lib/types";
import { IconArrowLeft, IconX } from "./icons";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type Variant =
  | "default"
  | "primary"
  | "outline"
  | "secondary"
  | "ghost"
  | "text"
  | "destructive"
  | "destructive-outline";
type Size = "sm" | "default" | "lg" | "icon" | "icon-sm";

const VARIANT_MAP: Record<Variant, "default" | "outline" | "secondary" | "ghost" | "destructive"> = {
  default: "default",
  primary: "default",
  outline: "outline",
  secondary: "secondary",
  ghost: "ghost",
  text: "ghost",
  destructive: "destructive",
  "destructive-outline": "outline",
};

const SIZE_MAP: Record<Size, "sm" | "default" | "lg" | "icon" | "icon-sm"> = {
  sm: "sm",
  default: "default",
  lg: "lg",
  icon: "icon",
  "icon-sm": "icon-sm",
};

export function Button({
  variant = "default",
  size = "default",
  className,
  asChildHref,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  asChildHref?: string;
}) {
  const cls = cn(
    buttonVariants({ variant: VARIANT_MAP[variant], size: SIZE_MAP[size] }),
    variant === "text" && "px-0 hover:bg-transparent hover:text-foreground",
    variant === "destructive-outline" && "text-destructive hover:bg-destructive/10",
    className,
  );

  if (asChildHref) {
    return (
      <Link
        href={asChildHref}
        className={cls}
        title={props.title}
        aria-label={props["aria-label"]}
      >
        {children}
      </Link>
    );
  }
  const rest = props as Record<string, unknown>;
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 表单                                                                */
/* ------------------------------------------------------------------ */

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <SInput className={className} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <STextarea className={cn("min-h-16", className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"select">, "size">) {
  return (
    <NativeSelect className={cn("w-full", className)} {...props}>
      {children}
    </NativeSelect>
  );
}

export function Label({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SLabel>) {
  return (
    <SLabel className={cn("mb-1.5 text-[0.6875rem] text-muted-foreground", className)} {...props}>
      {children}
    </SLabel>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-[0.625rem] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 容器                                                                */
/* ------------------------------------------------------------------ */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <SCard className={cn("gap-0 py-0", className)}>{children}</SCard>;
}

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "primary" | "success" | "warn" | "danger" | "secondary";
  className?: string;
}) {
  const map = {
    muted: "border-border bg-input/20 text-muted-foreground dark:bg-input/30",
    primary: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    success: "border-transparent bg-success/12 text-success dark:bg-success/18",
    warn: "border-transparent bg-warning/14 text-warning dark:bg-warning/18",
    danger: "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20",
  } as const;

  return (
    <SBadge variant="outline" className={cn("border", map[tone], className)}>
      {children}
    </SBadge>
  );
}

export function StatusBadge({
  status,
  reviewStatus = "NONE",
}: {
  status: TaskStatus;
  reviewStatus?: ReviewStatus;
}) {
  // 审核态优先展示：待审核 / 已通过 / 已退回
  if (status === "SUBMITTED") {
    if (reviewStatus === "APPROVED")
      return (
        <Badge tone="success">
          <span className="size-1 rounded-full bg-current" />
          已通过
        </Badge>
      );
    return (
      <Badge tone="primary">
        <span className="size-1 rounded-full bg-current" />
        待审核
      </Badge>
    );
  }
  if (status === "IN_PROGRESS") {
    if (reviewStatus === "REJECTED")
      return (
        <Badge tone="danger">
          <span className="size-1 rounded-full bg-current" />
          已退回
        </Badge>
      );
    return (
      <Badge tone="warn">
        <span className="size-1 rounded-full bg-current" />
        进行中
      </Badge>
    );
  }
  return (
    <Badge tone="muted">
      <span className="size-1 rounded-full bg-current" />
      待领取
    </Badge>
  );
}

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const tones = [
    "bg-foreground/10 text-foreground",
    "bg-foreground/15 text-foreground",
    "bg-foreground/[0.07] text-muted-foreground",
    "bg-foreground/12 text-foreground",
  ];
  return (
    <SAvatar className="after:hidden" style={{ width: size, height: size }}>
      <AvatarFallback
        className={cn("font-medium", tones[hash % tones.length])}
        style={{ fontSize: size * 0.38 }}
      >
        {name.slice(-2)}
      </AvatarFallback>
    </SAvatar>
  );
}

/* ------------------------------------------------------------------ */
/* 页面骨架                                                            */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
  meta,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft size={12} />
          {backLabel || "返回"}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-medium">{title}</h1>
            {meta}
          </div>
          {subtitle && (
            <p className="mt-1 max-w-[720px] text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
    </div>
  );
}

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>{children}</div>;
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <Empty className="border py-12">
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle className="text-xs font-medium">{title}</EmptyTitle>
        {desc && <EmptyDescription className="text-[0.6875rem]">{desc}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

export function Modal({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-none" style={{ maxWidth: width }} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
          {desc && <DialogDescription className="text-xs leading-relaxed">{desc}</DialogDescription>}
        </DialogHeader>
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <IconX size={13} />
        </button>
        {children && <div className="min-w-0">{children}</div>}
        {footer && <DialogFooter className="gap-1.5">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex h-7 items-center rounded-lg bg-muted p-[3px] text-muted-foreground">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-[22px] cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
            value === o.value ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
          )}
        >
          {o.label}
          {typeof o.count === "number" && <span className="text-[0.625rem] opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function StatTile({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-card p-3 ring-1 ring-foreground/10">
      <span className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="tnum text-lg leading-none font-medium">{value}</span>
        {unit && <span className="text-[0.625rem] text-muted-foreground">{unit}</span>}
      </div>
      {hint && <span className="text-[0.625rem] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export { Separator };
