import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { EventsContent } from "./events-content";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("in_game_name,role,is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active) redirect("/login");
  return <AppShell title="Eventos e atividade" userName={profile.in_game_name} role={profile.role}><EventsContent userId={user.id} role={profile.role} /></AppShell>;
}
