
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

type Occurrence = {
  id: string;
  title: string;
  occurrence_type: string;
  status: string;
  player_name: string | null;
  player_tag: string | null;
  attack_number: number | null;
  player_position?: number | null;
  attacked_target_name: string | null;
  expected_target_name: string | null;
  rule_reference: string | null;
  description: string;
  resolution: string | null;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  under_review: "Em análise",
  confirmed: "Confirmada",
  dismissed: "Descartada",
  resolved: "Resolvida",
};

const typeLabels: Record<string, string> = {
  strategy_error: "Erro de estratégia",
  missed_attack: "Ataque não realizado",
  conduct: "Conduta",
  other: "Outro",
};

const styles = {
  panel: {
    background: "var(--card, rgba(35, 39, 49, 0.88))",
    border: "1px solid var(--border, #414957)",
    borderRadius: 18,
    padding: 24,
    minWidth: 0,
  },
  stat: {
    background: "rgba(255,255,255,0.035)",
    border: "1px solid var(--border, #414957)",
    borderRadius: 14,
    padding: 18,
    minWidth: 0,
  },
  muted: {
    color: "var(--muted, #a4adbd)",
    fontSize: 13,
    lineHeight: 1.6,
  },
  label: {
    color: "var(--muted, #a4adbd)",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.07em",
  },
  value: {
    fontSize: 27,
    fontWeight: 800,
    lineHeight: 1.3,
  },
};

function getStatusStyle(status: string) {
  if (status === "pending") {
    return {
      color: "#ffd27a",
      background: "rgba(245, 158, 11, 0.12)",
      border: "1px solid rgba(245, 158, 11, 0.3)",
    };
  }

  if (status === "under_review") {
    return {
      color: "#93c5fd",
      background: "rgba(59, 130, 246, 0.12)",
      border: "1px solid rgba(59, 130, 246, 0.3)",
    };
  }

  if (status === "confirmed") {
    return {
      color: "#fca5a5",
      background: "rgba(239, 68, 68, 0.12)",
      border: "1px solid rgba(239, 68, 68, 0.3)",
    };
  }

  return {
    color: "#b8c1d1",
    background: "rgba(148, 163, 184, 0.1)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
  };
}

export default async function OccurrencesPage() {
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

  const isLeader =
    profile?.role === "leader" ||
    profile?.role === "co_leader" ||
    profile?.role === "coLeader";

  if (!profile?.is_active || !isLeader) {
    redirect("/dashboard");
  }

  const { data: occurrences, error } = await supabase
    .from("war_occurrences")
    .select(`
      id,
      title,
      occurrence_type,
      status,
      player_name,
      player_tag,
      attack_number,
      player_position,
      attacked_target_name,
      expected_target_name,
      rule_reference,
      description,
      resolution,
      created_at
    `)
    .order("created_at", { ascending: false });

  const items = (occurrences ?? []) as Occurrence[];

  const pendingCount = items.filter(
    (item) => item.status === "pending"
  ).length;

  const reviewCount = items.filter(
    (item) => item.status === "under_review"
  ).length;

  const completedCount = items.filter(
    (item) =>
      ["confirmed", "dismissed", "resolved"].includes(item.status)
  ).length;

  return (
    <AppShell
      title="Central de Ocorrências"
      userName={profile.in_game_name || "Liderança"}
      role={profile.role}
    >
      <div style={{ display: "grid", gap: 20 }}>
        <section style={styles.panel}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={styles.label}>Centro de comando</div>
              <h2 style={{ fontSize: 23, margin: "8px 0" }}>
                Monitoramento de infrações
              </h2>
              <p style={{ ...styles.muted, margin: 0 }}>
                Ocorrências registradas para análise e decisão da liderança.
              </p>
            </div>

            <span
              style={{
                ...styles.stat,
                padding: "9px 13px",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {items.length} registros
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
              gap: 12,
              marginTop: 24,
            }}
          >
            <div style={styles.stat}>
              <div style={styles.label}>Pendentes</div>
              <div style={{ ...styles.value, marginTop: 8 }}>
                {pendingCount.toString().padStart(2, "0")}
              </div>
              <p style={{ ...styles.muted, marginBottom: 0 }}>
                Aguardando decisão
              </p>
            </div>

            <div style={styles.stat}>
              <div style={styles.label}>Em análise</div>
              <div style={{ ...styles.value, marginTop: 8 }}>
                {reviewCount.toString().padStart(2, "0")}
              </div>
              <p style={{ ...styles.muted, marginBottom: 0 }}>
                Em avaliação pela liderança
              </p>
            </div>

            <div style={styles.stat}>
              <div style={styles.label}>Finalizadas</div>
              <div style={{ ...styles.value, marginTop: 8 }}>
                {completedCount.toString().padStart(2, "0")}
              </div>
              <p style={{ ...styles.muted, marginBottom: 0 }}>
                Com decisão registrada
              </p>
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>
                Fila de ocorrências
              </h2>
              <p style={{ ...styles.muted, margin: 0 }}>
                Mais recentes primeiro. Nenhum formulário manual.
              </p>
            </div>

            <Link
              href="/votacoes"
              className="button"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "11px 16px",
                borderRadius: 10,
              }}
            >
              Central de votações →
            </Link>
          </div>

          {error ? (
            <p role="alert" style={{ color: "#fca5a5" }}>
              Não foi possível carregar as ocorrências: {error.message}
            </p>
          ) : items.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                border: "1px dashed var(--border, #414957)",
                borderRadius: 14,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
              <h3 style={{ margin: "0 0 8px" }}>
                Nenhuma ocorrência detectada
              </h3>
              <p
                style={{
                  ...styles.muted,
                  maxWidth: 440,
                  margin: "0 auto",
                }}
              >
                Quando o sistema registrar uma infração de guerra, ela
                aparecerá aqui para análise da liderança.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {items.map((item) => (
                <article
                  key={item.id}
                  style={{
                    border: "1px solid var(--border, #414957)",
                    borderRadius: 14,
                    padding: 18,
                    background: "rgba(255,255,255,0.018)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          flexShrink: 0,
                          borderRadius: 12,
                          display: "grid",
                          placeItems: "center",
                          background: "rgba(239,68,68,0.12)",
                          color: "#fca5a5",
                          fontSize: 21,
                        }}
                      >
                        !
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={styles.label}>
                          {typeLabels[item.occurrence_type] ??
                            item.occurrence_type}
                          {item.attack_number
                            ? ` · ${item.attack_number}º ataque`
                            : ""}
                        </div>

                        <h3
                          style={{
                            margin: "6px 0",
                            fontSize: 17,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {item.title}
                        </h3>

                        <p style={{ ...styles.muted, margin: 0 }}>
                          {item.player_name || "Jogador não identificado"}
                          {item.player_tag ? ` · ${item.player_tag}` : ""}
                          {item.player_position != null
                            ? ` · Posição #${item.player_position}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <span
                      style={{
                        ...getStatusStyle(item.status),
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                      marginTop: 18,
                    }}
                  >
                    <div style={styles.stat}>
                      <div style={styles.label}>Alvo atacado</div>
                      <strong style={{ display: "block", marginTop: 7 }}>
                        {item.attacked_target_name || "Não informado"}
                      </strong>
                    </div>

                    <div style={styles.stat}>
                      <div style={styles.label}>Alvo esperado</div>
                      <strong style={{ display: "block", marginTop: 7 }}>
                        {item.expected_target_name || "Não informado"}
                      </strong>
                    </div>
                  </div>

                  <p
                    style={{
                      margin: "16px 0 8px",
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.description}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: "1px solid var(--border, #414957)",
                    }}
                  >
                    <div style={styles.muted}>
                      {item.rule_reference
                        ? `Memorial: ${item.rule_reference} · `
                        : ""}
                      {new Date(item.created_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "America/Sao_Paulo",
                      })}
                    </div>

                    {item.resolution && (
                      <span style={styles.muted}>
                        Decisão: {item.resolution}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
