import { redirect } from "next/navigation";
import { FantasyApp } from "@/components/fantasy-app";
import { getSessionUser } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const db = getSupabaseAdmin();
  if (db) {
    const user = await getSessionUser(db);
    if (!user) redirect("/login");
  }
  return <FantasyApp />;
}
