"use client";

import { useState } from "react";
import { Button, Input, Label } from "./ui";
import { IconAlert } from "./icons";

const DEMO = [
  { label: "租户管理员", email: "admin@xingye.ai", hint: "星野机器人" },
  { label: "标注员", email: "anna@xingye.ai", hint: "星野机器人" },
  { label: "标注员", email: "bo@xingye.ai", hint: "星野机器人" },
  { label: "租户管理员", email: "admin@chaoxi.ai", hint: "潮汐智造" },
  { label: "平台管理员", email: "ops@platform.ai", hint: "跨租户" },
];

export function LoginForm() {
  const [email, setEmail] = useState("admin@xingye.ai");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败");
        setLoading(false);
        return;
      }
      // 用整页跳转，确保服务端 /studio 的重定向（进入进行中任务）生效
      window.location.assign(data.role === "ANNOTATOR" ? "/studio" : "/dashboard");
    } catch {
      setError("网络异常，请重试");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[320px]">
      <div className="mb-4">
        <h1 className="text-base font-medium">登录工作台</h1>
        <p className="mt-1 text-xs text-muted-foreground">使用团队分配的账号进入标注平台</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-col">
          <Label htmlFor="email">工作邮箱</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>
        <div className="flex flex-col">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 位"
            required
          />
        </div>

        {error && (
          <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-[0.6875rem] text-destructive">
            <IconAlert size={12} className="mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" size="lg" className="mt-0.5 w-full" disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? "正在登录…" : "进入平台"}
        </Button>
      </form>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-2 text-[0.625rem] tracking-wide text-muted-foreground uppercase">
          <span className="h-px flex-1 bg-border" />
          演示账号
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="flex flex-col">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => {
                setEmail(d.email);
                setPassword("demo1234");
                setError(null);
              }}
              className="group flex w-full cursor-pointer items-center justify-between rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-1.5">
                <span className="text-[0.6875rem]">{d.label}</span>
                <span className="text-[0.625rem] text-muted-foreground">{d.hint}</span>
              </span>
              <span className="font-mono text-[0.625rem] text-muted-foreground group-hover:text-foreground">
                {d.email}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 px-1.5 text-[0.625rem] text-muted-foreground/70">
          统一密码 demo1234 · 点击任一账号自动填入
        </p>
      </div>
    </div>
  );
}
