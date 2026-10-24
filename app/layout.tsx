import type { Metadata } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/theme";

export const metadata: Metadata = {
  title: "Segmenta · 视频片段标注平台",
  description: "让多个团队的标注员在视频上标出时间段，管理员按天统计有效工作量。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
