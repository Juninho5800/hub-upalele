
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { SolicitationsContent } from "./solicitations-content";

export const dynamic = "force-dynamic";

export default async function SolicitationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("in_game_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) redirect("/dashboard");

  if (
    profile.role !== "leader" &&
    profile.role !== "co_leader"
  ) {
    redirect("/dashboard");
  }

  const { data: requests, error } = await supabase
    .from("tag_link_requests")
    .select("id, player_tag, in_game_name, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[SOLICITATIONS PAGE]", error);
    throw new Error("Não foi possível carregar as solicitações.");
  }

  return (
    <AppShell
      title="Solicitações de acesso"
      userName={profile.in_game_name}
      role={profile.role}
    >
      <SolicitationsContent requests={requests ?? []} />
    </AppShell>
  );
}
