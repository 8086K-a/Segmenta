import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/toast";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <ToastProvider>
      <AppShell user={user}>{children}</AppShell>
    </ToastProvider>
  );
}
