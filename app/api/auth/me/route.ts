import { getSessionUser } from "@/lib/auth";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ user: null }, 200);
  return json({ user });
}
