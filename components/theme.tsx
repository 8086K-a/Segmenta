"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./icons";

export const THEME_KEY = "segmenta-theme";

/** 在首屏绘制前应用主题，避免闪白 */
export function ThemeScript() {
  const code = `(function(){try{var v=localStorage.getItem("${THEME_KEY}");var d=v?v==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var el=document.documentElement;el.classList.toggle("dark",d);el.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      /* 隐私模式下忽略 */
    }
  }

  return (
    <button
      onClick={toggle}
      title={dark ? "切换到浅色模式" : "切换到深色模式"}
      aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}
      className={`flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className}`}
    >
      {dark ? <IconSun size={14} /> : <IconMoon size={14} />}
    </button>
  );
}
