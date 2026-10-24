"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { IconAlert, IconCheck, IconX } from "./icons";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: ToastKind; detail?: string };

const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void }>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), t.kind === "error" ? 5200 : 3200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-[400px] -translate-x-1/2 flex-col gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className="anim-in pointer-events-auto flex items-start gap-2.5 rounded-md border border-border bg-popover px-3 py-2.5 shadow-[var(--shadow-float)]"
          >
            <span
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
                t.kind === "success"
                  ? "bg-constructive/15 text-constructive"
                  : t.kind === "error"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-accent text-muted-foreground"
              }`}
            >
              {t.kind === "success" ? <IconCheck size={10} /> : t.kind === "error" ? <IconAlert size={10} /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs leading-snug">{t.message}</div>
              {t.detail && <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.detail}</div>}
            </div>
            <button
              onClick={() => setItems((prev) => prev.filter((i) => i.id !== t.id))}
              className="mt-0.5 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
              aria-label="关闭提示"
            >
              <IconX size={11} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
