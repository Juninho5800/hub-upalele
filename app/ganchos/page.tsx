
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { HooksAutoRefresh } from "./hooks-auto-refresh";
import { HooksManager } from "@/components/hooks-manager";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HooksPage() {
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

  if (!profile?.is_active) redirect("/login");

  const { data, error } = await supabase
    .from("punishments")
    .select(
      "id, member_name, punishment_label, duration_wars, reason, return_date, source_note, status, created_at"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const role = (profile.role ?? "").trim().toLowerCase();
  const canManage = ["leader", "co_leader", "coleader"].includes(role);

  return (
    <AppShell
      title="Ganchos ativos"
      userName={profile.in_game_name || "Jogador"}
      role={profile.role}
    >
      <HooksAutoRefresh />

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Ganchos ativos</h2>
            <p>
              Datas de origem foram mantidas em observações quando não havia
              ano informado.
            </p>
          </div>

          <span className="badge gold">
            {data?.length ?? 0} registros
          </span>
        </div>

        {error ? (
          <p className="error">{error.message}</p>
        ) : (
          <HooksManager
            rows={data ?? []}
            canManage={canManage}
          />
        )}
      </section>
    </AppShell>
  );
}
