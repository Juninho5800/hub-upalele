import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

type WarPayload = {
  clan?: { name?: string };
  opponent?: { name?: string };
};

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("in_game_name,role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    return (
      <main className="main">
        <section className="card">
          <h1>Perfil do clã não encontrado</h1>
          <p className="muted">
            Sua conta autenticou, mas não há perfil ativo em
            public.profiles associado a este UID. Peça à liderança
            para conferir o cadastro.
          </p>
          <p className="muted">UID atual: {user.id}</p>
        </section>
      </main>
    );
  }

  const [
    { count: rulesCount },
    { count: punishmentsCount },
    { count: historyCount },
    { data: hooks },
    { data: wars },
  ] = await Promise.all([
    supabase
      .from("memorial_rules")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true),

    supabase
      .from("punishments")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),

    supabase
      .from("historical_punishment_records")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("punishments")
      .select("member_name,reason,punishment_label")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("wars")
      .select(
        "id,status,preparation_start,war_start,war_end,clan_stars,opponent_stars,team_size,raw_payload"
      )
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const latestWar = wars?.[0] ?? null;

  let warAttacksCount = 0;
  let warOccurrencesCount = 0;
  let pendingOccurrencesCount = 0;

  if (latestWar) {
    const [
      { data: warAttacks },
      { data: occurrences },
    ] = await Promise.all([
      supabase
        .from("war_attacks")
        .select("id,stars,destruction_percent")
        .eq("war_id", latestWar.id),

      supabase
        .from("war_occurrences")
        .select("id,status")
        .eq("war_id", latestWar.id),
    ]);

    warAttacksCount = warAttacks?.length ?? 0;
    warOccurrencesCount = occurrences?.length ?? 0;

    pendingOccurrencesCount =
      occurrences?.filter(
        (occurrence) =>
          occurrence.status === "pending" ||
          occurrence.status === "under_review"
      ).length ?? 0;
  }

  const recentWars = wars ?? [];

  const endedWars = recentWars.filter(
    (war) => war.status === "ended"
  );

  const wins = endedWars.filter(
    (war) => (war.clan_stars ?? 0) > (war.opponent_stars ?? 0)
  ).length;

  const losses = endedWars.filter(
    (war) => (war.clan_stars ?? 0) < (war.opponent_stars ?? 0)
  ).length;

  const draws = endedWars.filter(
    (war) => (war.clan_stars ?? 0) === (war.opponent_stars ?? 0)
  ).length;

  const payload = (latestWar?.raw_payload ?? {}) as WarPayload;

  const opponentName =
    payload.opponent?.name ?? "Adversário";

  const warResult = !latestWar
    ? "Sem dados"
    : latestWar.status === "ended"
      ? (latestWar.clan_stars ?? 0) >
        (latestWar.opponent_stars ?? 0)
        ? "Vitória"
        : (latestWar.clan_stars ?? 0) <
          (latestWar.opponent_stars ?? 0)
          ? "Derrota"
          : "Empate"
      : latestWar.status === "in_war"
        ? "Em andamento"
        : latestWar.status === "preparation"
          ? "Preparação"
          : "Sincronizada";

  const resultColor =
    warResult === "Vitória"
      ? "#22c55e"
      : warResult === "Derrota"
        ? "#f87171"
        : "#eab308";

  return (
    <AppShell
      title="Visão geral"
      userName={profile.in_game_name}
      role={profile.role}
    >
      <div className="grid stats">
        {[
          [
            "Regras do memorial",
            rulesCount ?? 0,
            "regras publicadas",
          ],
          [
            "Ganchos ativos",
            punishmentsCount ?? 0,
            "registros marcados ativos",
          ],
          [
            "Histórico antigo",
            historyCount ?? 0,
            "linhas importadas",
          ],
          [
            "Seu acesso",
            profile.role,
            "perfil autenticado",
          ],
        ].map(([label, value, note]) => (
          <section className="card" key={String(label)}>
            <div className="stat-label">{label}</div>
            <div className="stat-number">{value}</div>
            <div className="muted">{note}</div>
          </section>
        ))}
      </div>

      <div className="grid content-grid">
        <div>
          {/* WAR ROOM */}
          <section
            className="banner"
            style={{
              position: "relative",
              overflow: "hidden",
              background:
                "linear-gradient(125deg, #382936 0%, #292b37 55%, #202631 100%)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span className="badge gold">⚔ WAR ROOM</span>

              {latestWar && (
                <span
                  className="badge"
                  style={{
                    color: resultColor,
                    borderColor: resultColor,
                  }}
                >
                  ● {warResult}
                </span>
              )}
            </div>

            <h2 style={{ marginTop: 14 }}>
              {latestWar
                ? "Última guerra de clãs"
                : "Central de guerra"}
            </h2>

            {latestWar ? (
              <>
                <p className="muted">
                  UPALELE contra {opponentName}
                </p>

                {/* PLACAR */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    gap: 12,
                    margin: "22px 0",
                  }}
                >
                  <div
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div className="muted">UPALELE</div>
                    <div
                      style={{
                        fontSize: 38,
                        fontWeight: 900,
                        marginTop: 5,
                      }}
                    >
                      {latestWar.clan_stars ?? 0} ★
                    </div>
                  </div>

                  <strong
                    style={{
                      fontSize: 15,
                      color: "#aaa",
                    }}
                  >
                    VS
                  </strong>

                  <div
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      padding: 16,
                      textAlign: "right",
                    }}
                  >
                    <div className="muted">{opponentName}</div>
                    <div
                      style={{
                        fontSize: 38,
                        fontWeight: 900,
                        marginTop: 5,
                      }}
                    >
                      {latestWar.opponent_stars ?? 0} ★
                    </div>
                  </div>
                </div>

                {/* INDICADORES */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(110px, 1fr))",
                    gap: 10,
                    marginBottom: 18,
                  }}
                >
                  {[
                    {
                      label: "Ataques sincronizados",
                      value: warAttacksCount,
                    },
                    {
                      label: "Ocorrências",
                      value: warOccurrencesCount,
                    },
                    {
                      label: "Pendentes",
                      value: pendingOccurrencesCount,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <div
                        className="muted"
                        style={{ fontSize: 11 }}
                      >
                        {item.label}
                      </div>

                      <strong
                        style={{
                          display: "block",
                          fontSize: 25,
                          marginTop: 5,
                        }}
                      >
                        {item.value}
                      </strong>
                    </div>
                  ))}
                </div>

                <p className="muted" style={{ fontSize: 12 }}>
                  {latestWar.team_size
                    ? `${latestWar.team_size} jogadores por equipe`
                    : "Guerra sincronizada pelo Clash of Clans"}
                  {latestWar.preparation_start
                    ? ` · ${new Date(
                        latestWar.preparation_start
                      ).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
              </>
            ) : (
              <div style={{ margin: "18px 0" }}>
                <h3>Nenhuma guerra sincronizada</h3>

                <p className="muted">
                  Quando os dados da API do Clash of Clans forem
                  sincronizados, o placar, os ataques e as
                  ocorrências aparecerão automaticamente aqui.
                </p>
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              <Link className="btn primary" href="/war-room">
  Abrir War Room →
</Link>

              <Link className="btn" href="/ataques">
                Assistente de ataques
              </Link>
            </div>
          </section>

          {/* HISTÓRICO DE GUERRAS */}
          <section className="card">
            <div className="section-head">
              <div>
                <h2>Desempenho nas guerras</h2>
                <p>Últimas guerras sincronizadas</p>
              </div>

              <Link className="btn" href="/war-room">
  Ver histórico
</Link>
            </div>

            {endedWars.length > 0 ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {[
                    {
                      label: "Vitórias",
                      value: wins,
                      color: "#22c55e",
                    },
                    {
                      label: "Derrotas",
                      value: losses,
                      color: "#f87171",
                    },
                    {
                      label: "Empates",
                      value: draws,
                      color: "#eab308",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        background: "var(--surface, #292d38)",
                        borderRadius: 10,
                        padding: 14,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          color: item.color,
                          fontSize: 25,
                          fontWeight: 900,
                        }}
                      >
                        {item.value}
                      </div>

                      <small className="muted">
                        {item.label}
                      </small>
                    </div>
                  ))}
                </div>

                <p className="muted" style={{ marginTop: 12 }}>
                  Resultado calculado com base nas últimas{" "}
                  {recentWars.length} guerras sincronizadas.
                </p>
              </>
            ) : (
              <p className="muted">
                Ainda não há guerras encerradas suficientes para
                apresentar o histórico de resultados.
              </p>
            )}
          </section>

          {/* GANCHOS ATIVOS */}
          <section className="card">
            <div className="section-head">
              <div>
                <h2>Ganchos ativos</h2>
                <p>Registros importados para conferência</p>
              </div>

              <Link className="btn" href="/ganchos">
                Ver todos
              </Link>
            </div>

            <div className="list">
              {hooks?.length ? (
                hooks.map((h, i) => (
                  <div className="item" key={i}>
                    <div className="avatar">
                      {h.member_name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="item-main">
                      <b>{h.member_name}</b>
                      <small>
                        {h.reason || h.punishment_label}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Ainda não há ganchos carregados. Execute a
                  importação inicial do projeto.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* ACESSO RÁPIDO */}
        <div className="card">
          <div className="section-head">
            <div>
              <h2>Acesso rápido</h2>
              <p>Conteúdo conectado ao banco</p>
            </div>
          </div>

          <div className="list">
            {[
              [
                "/memorial",
                "Consultar memorial",
                "Pesquisar regras",
              ],
              [
                "/historico",
                "Histórico punitivo",
                "Consultar registros antigos",
              ],
              [
                "/membros",
                "Cadastro operacional",
                "Novatos e observações",
              ],
              [
                "/ocorrencias",
                "Central de ocorrências",
                "Analisar desvios estratégicos",
              ],
              [
                "/votacoes",
                "Votações da liderança",
                "Decisões e punições",
              ],
            ].map(([href, title, sub]) => (
              <Link
                className="item"
                href={href}
                key={href}
              >
                <div className="avatar">→</div>

                <div className="item-main">
                  <b>{title}</b>
                  <small>{sub}</small>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}