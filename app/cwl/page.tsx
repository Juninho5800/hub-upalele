import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { CwlDashboard } from "@/components/cwl-dashboard";

export const dynamic = "force-dynamic";

export default async function CwlPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("in_game_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    profile?.is_active !== true ||
    !profile.role
  ) {
    redirect("/login");
  }

  return (
    <AppShell
      title="Clan War League"
      userName={profile.in_game_name || "Jogador"}
      role={profile.role}
    >
      <CwlDashboard role={profile.role} />
    </AppShell>
  );
}
