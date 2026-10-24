import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/AppShell";
import { ThemeToggle } from "@/components/theme";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "ANNOTATOR" ? "/studio" : "/dashboard");

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div className="dotgrid pointer-events-none absolute inset-0 opacity-60" />

      <header className="relative flex h-12 items-center gap-1.5 px-4">
        <span className="flex size-6 items-center justify-center rounded-[7px] bg-primary text-primary-foreground">
          <Logo size={13} />
        </span>
        <span className="text-xs font-medium">Segmenta</span>
        <span className="ml-1 rounded-md border border-border px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
          视频片段标注平台
        </span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-20">
        <LoginForm />
      </main>
    </div>
  );
}
