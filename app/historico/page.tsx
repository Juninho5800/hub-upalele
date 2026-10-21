
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { HistoricalPunishmentsManager } from "@/components/historical-punishments-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HistoryPage() {
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
    .from("historical_punishment_records")
    .select("id, source_order, member_name, date_text, notes, source_label")
    .eq("is_active", true)
    .order("source_order");

  const role = (profile.role ?? "").trim().toLowerCase();
  const canManage = ["leader", "co_leader", "coleader"].includes(role);

  return (
    <AppShell
      title="Histórico punitivo"
      userName={profile.in_game_name || "Jogador"}
      role={profile.role}
    >
      <section className="card">
        <div className="section-head">
          <div>
            <h2>Histórico antigo</h2>
            <p>
              Registros preservados conforme o material enviado.
              Registros anulados são ocultados desta listagem.
            </p>
          </div>
          <span className="badge">{data?.length ?? 0} registros</span>
        </div>

        {error ? (
          <p className="error">{error.message}</p>
        ) : (
          <HistoricalPunishmentsManager
            rows={data ?? []}
            canManage={canManage}
          />
        )}
      </section>
    </AppShell>
  );
}
