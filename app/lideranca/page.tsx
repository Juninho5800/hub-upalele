import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { LeadershipContent } from "./leadership-content";

export default async function LeadershipPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("in_game_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) redirect("/dashboard");
  if (profile.role !== "leader" && profile.role !== "co_leader") redirect("/dashboard");

  return (
    <AppShell title="Central da liderança" userName={profile.in_game_name} role={profile.role}>
      <LeadershipContent />
    </AppShell>
  );
}
