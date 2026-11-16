
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

  const [
    { data: historicalData, error: historicalError },
    { data: punishmentData, error: punishmentError },
  ] = await Promise.all([
    supabase
      .from("historical_punishment_records")
      .select("id, source_order, member_name, date_text, notes, source_label")
      .eq("is_active", true)
      .order("source_order", { ascending: true }),

    supabase
      .from("punishments")
      .select(
        "id, member_name, applied_on, punishment_label, reason, return_date, source_note, created_at, status"
      )
      .ilike("punishment_label", "%gancho%")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
  ]);

  const error = historicalError || punishmentError;

  const historicalRows = (historicalData ?? []).map((row) => ({
    id: row.id,
    source_order: row.source_order,
    member_name: row.member_name,
    date_text: row.date_text,
    notes: row.notes,
    source_label: row.source_label,
    punishment_label: null as string | null,
    return_date: null as string | null,
    origin: "historical" as const,
  }));

  const automaticRows = (punishmentData ?? []).map((row) => ({
    id: row.id,
    source_order: null as number | null,
    member_name: row.member_name,
    date_text: row.applied_on,
    notes: null,
    source_label: "Votação da liderança",
    punishment_label: row.punishment_label,
    return_date: row.return_date,
    origin: "automatic" as const,
  }));

  const rows = [...historicalRows, ...automaticRows];

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
            <h2>Histórico punitivo</h2>
            <p>
              Registros antigos preservados e novas punições
              integradas automaticamente pelas votações.
            </p>
          </div>

          <span className="badge">{rows.length} registros</span>
        </div>

        {error ? (
          <p className="error">{error.message}</p>
        ) : (
          <HistoricalPunishmentsManager
            rows={rows}
            canManage={canManage}
          />
        )}
      </section>
    </AppShell>
  );
}
