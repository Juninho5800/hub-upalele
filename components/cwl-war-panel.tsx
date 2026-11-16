
"use client";

import { useCallback, useEffect, useState } from "react";

type Round = {
  id: string;
  roundNumber: number;
  status: string;
  warId: string | null;
  warStatus: string | null;
  opponentName: string | null;
  opponentTag: string | null;
  clanStars: number | null;
  opponentStars: number | null;
  teamSize: number | null;
  warStart: string | null;
  warEnd: string | null;
};

type Overview = {
  success?: boolean;
  season?: {
    id: string;
    season: string;
    league_name: string | null;
    group_number: number | null;
    status: string;
  } | null;
  rounds?: Round[];
  error?: string;
};

const statusLabels: Record<string, string> = {
  scheduled: "Agendada",
  preparation: "Preparação",
  in_progress: "Em andamento",
  completed: "Concluída",
  processed: "Processada",
  processing: "Processando",
  failed: "Falha",
  unknown: "Aguardando dados",
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusColor(status: string) {
  switch (status) {
    case "completed":
    case "processed":
      return {
        color: "#75d6a0",
        background: "rgba(50, 180, 110, 0.12)",
        border: "rgba(50, 180, 110, 0.3)",
      };

    case "in_progress":
      return {
        color: "#f3c76b",
        background: "rgba(243, 199, 107, 0.12)",
        border: "rgba(243, 199, 107, 0.3)",
      };

    case "preparation":
      return {
        color: "#8ebaff",
        background: "rgba(90, 150, 240, 0.12)",
        border: "rgba(90, 150, 240, 0.3)",
      };

    case "failed":
      return {
        color: "#ff8585",
        background: "rgba(230, 70, 70, 0.12)",
        border: "rgba(230, 70, 70, 0.3)",
      };

    default:
      return {
        color: "#aeb8c8",
        background: "rgba(150, 160, 180, 0.1)",
        border: "rgba(150, 160, 180, 0.2)",
      };
  }
}

const panelStyle = {
  background: "var(--card, #222630)",
  border: "1px solid var(--border, #414957)",
  borderRadius: 16,
  padding: 22,
} as const;

export function CwlWarPanel({
  canManage,
}: {
  canManage: boolean;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/cwl/overview", {
        cache: "no-store",
      });

      const result: Overview = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Não foi possível carregar a CWL."
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro de comunicação com o servidor."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function synchronize() {
    if (syncing || loading) return;

    const confirmed = window.confirm(
      "Deseja sincronizar os dados da CWL agora?\n\n" +
        "Os confrontos e ataques disponíveis serão atualizados."
    );

    if (!confirmed) return;

    setSyncing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/cwl/sync", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Falha ao sincronizar a CWL."
        );
      }

      if (result.available === false) {
        setMessage(
          result.message ||
            "Não existe uma CWL disponível para sincronização no momento."
        );
        return;
      }

      if (!result.success) {
        throw new Error(
          result.error || "Falha ao sincronizar a CWL."
        );
      }

      setMessage(
        `Sincronização concluída: ${result.warsSaved ?? 0} guerras e ${result.attacksSaved ?? 0} ataques registrados.`
      );

      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro de comunicação durante a sincronização."
      );
    } finally {
      setSyncing(false);
    }
  }

  const rounds = data?.rounds ?? [];

  const completed = rounds.filter(
    (round) =>
      round.status === "completed" ||
      round.status === "processed"
  ).length;

  const inProgress = rounds.filter(
    (round) => round.status === "in_progress"
  ).length;

  const seasonStatus = data?.season?.status ?? "";
  const progress = Math.min((completed / 7) * 100, 100);

  return (
    <div style={{ display: "grid", gap: 22, minWidth: 0 }}>
      {/* CABEÇALHO DA TEMPORADA */}
      <section
        style={{
          ...panelStyle,
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(120deg, #202630 0%, #29232b 65%, #38232b 100%)",
          borderColor: "rgba(212, 175, 55, 0.25)",
          padding: 26,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 280px" }}>
            <div
              style={{
                color: "#e7c46d",
                fontSize: 11,
                fontWeight: 850,
                letterSpacing: "0.15em",
                marginBottom: 10,
              }}
            >
              UPALELE · CLAN WAR LEAGUE
            </div>

            <h2
              style={{
                color: "#fff",
                fontSize: 27,
                fontWeight: 850,
                letterSpacing: "-0.04em",
                margin: "0 0 7px",
              }}
            >
              Guerras da liga
            </h2>

            <p
              style={{
                color: "#b8c0ce",
                fontSize: 13,
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Acompanhe os sete confrontos da UPALELE durante a temporada.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={synchronize}
              disabled={syncing || loading}
              style={{
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                padding: "13px 19px",
                background:
                  syncing || loading
                    ? "#555b68"
                    : "linear-gradient(135deg, #b52e43, #e04b60)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                cursor: syncing || loading ? "not-allowed" : "pointer",
                boxShadow: "0 6px 18px rgba(190, 45, 65, 0.2)",
                whiteSpace: "nowrap",
              }}
            >
              {syncing ? "Sincronizando..." : "↻ Sincronizar CWL"}
            </button>
          )}
        </div>

        {data?.season && (
          <div style={{ marginTop: 26 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 9,
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  background: "rgba(212,175,55,0.13)",
                  border: "1px solid rgba(212,175,55,0.3)",
                  color: "#e7c46d",
                  padding: "7px 11px",
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                TEMPORADA {data.season.season}
              </span>

              <span
                style={{
                  background: "rgba(255,255,255,0.07)",
                  color: "#d5dbe5",
                  padding: "7px 11px",
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {statusLabels[seasonStatus] ?? seasonStatus}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
                gap: 12,
              }}
            >
              {[
                {
                  label: "RODADAS",
                  value: "07",
                  detail: "Confrontos da liga",
                },
                {
                  label: "CONCLUÍDAS",
                  value: `${completed}/7`,
                  detail: "Rodadas finalizadas",
                },
                {
                  label: "EM ANDAMENTO",
                  value: String(inProgress),
                  detail: "Confrontos ativos",
                },
                {
                  label: "GRUPO",
                  value: data.season.group_number != null
                    ? `#${data.season.group_number}`
                    : "—",
                  detail: data.season.league_name ?? "Liga não informada",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: "rgba(10, 13, 20, 0.3)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 11,
                    padding: 15,
                  }}
                >
                  <div
                    style={{
                      color: "#9ba6b7",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.1em",
                    }}
                  >
                    {stat.label}
                  </div>

                  <div
                    style={{
                      color: "#fff",
                      fontSize: 25,
                      fontWeight: 850,
                      margin: "6px 0 3px",
                    }}
                  >
                    {stat.value}
                  </div>

                  <div
                    style={{
                      color: "#929cac",
                      fontSize: 11,
                    }}
                  >
                    {stat.detail}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  color: "#b8c0ce",
                  fontSize: 11,
                  marginBottom: 8,
                }}
              >
                <span>Progresso da temporada</span>
                <strong style={{ color: "#e7c46d" }}>
                  {completed} de 7 rodadas
                </strong>
              </div>

              <div
                style={{
                  height: 7,
                  borderRadius: 20,
                  background: "rgba(255,255,255,0.1)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    borderRadius: 20,
                    background:
                      "linear-gradient(90deg, #b58b35, #f0d17c)",
                    transition: "width 300ms ease",
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* FEEDBACK */}
      {message && (
        <section
          style={{
            ...panelStyle,
            borderColor: "rgba(80, 190, 130, 0.35)",
            color: "#82d9a6",
            fontSize: 13,
          }}
          role="status"
        >
          ✓ {message}
        </section>
      )}

      {error && (
        <section
          style={{
            ...panelStyle,
            borderColor: "rgba(230, 90, 90, 0.4)",
            color: "#ff9292",
            fontSize: 13,
          }}
          role="alert"
        >
          {error}
        </section>
      )}

      {/* CALENDÁRIO */}
      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 15,
          }}
        >
          <div>
            <div
              style={{
                color: "#e7c46d",
                fontSize: 10,
                fontWeight: 850,
                letterSpacing: "0.13em",
                marginBottom: 6,
              }}
            >
              TEMPORADA COMPETITIVA
            </div>

            <h2
              style={{
                color: "var(--foreground, #fff)",
                fontSize: 21,
                fontWeight: 850,
                margin: 0,
              }}
            >
              Calendário de confrontos
            </h2>

            <p
              style={{
                color: "var(--muted, #a4adbd)",
                fontSize: 12,
                marginTop: 5,
              }}
            >
              Uma guerra da UPALELE por rodada.
            </p>
          </div>

          <span
            style={{
              color: "var(--muted, #a4adbd)",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {completed}/7 FINALIZADAS
          </span>
        </div>

        {loading ? (
          <div style={panelStyle}>
            <p style={{ color: "var(--muted, #a4adbd)", margin: 0 }}>
              Carregando confrontos...
            </p>
          </div>
        ) : !data?.season ? (
          <div
            style={{
              ...panelStyle,
              textAlign: "center",
              padding: "45px 22px",
            }}
          >
            <div style={{ fontSize: 34, marginBottom: 12 }}>⚔</div>

            <h3
              style={{
                color: "var(--foreground, #fff)",
                fontSize: 18,
                fontWeight: 800,
                margin: "0 0 8px",
              }}
            >
              Nenhuma temporada registrada
            </h3>

            <p
              style={{
                color: "var(--muted, #a4adbd)",
                fontSize: 13,
                maxWidth: 470,
                margin: "0 auto",
                lineHeight: 1.7,
              }}
            >
              Quando a próxima CWL estiver disponível, utilize o botão
              de sincronização para carregar os sete confrontos da UPALELE.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            {Array.from({ length: 7 }, (_, index) => {
              const round = rounds.find(
                (item) => item.roundNumber === index + 1
              );

              const roundStatus = round?.status ?? "scheduled";
              const statusColor = getStatusColor(roundStatus);
              const hasWar = Boolean(round?.warId);

              return (
                <article
                  key={index + 1}
                  style={{
                    background: "var(--card, #222630)",
                    border: "1px solid var(--border, #414957)",
                    borderRadius: 15,
                    overflow: "hidden",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      height: 3,
                      background: hasWar
                        ? "linear-gradient(90deg, #a92e40, #e7c46d)"
                        : "rgba(150,160,180,0.2)",
                    }}
                  />

                  <div style={{ padding: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 17,
                      }}
                    >
                      <span
                        style={{
                          color: "#e7c46d",
                          fontSize: 10,
                          fontWeight: 850,
                          letterSpacing: "0.1em",
                        }}
                      >
                        RODADA {String(index + 1).padStart(2, "0")}
                      </span>

                      <span
                        style={{
                          color: statusColor.color,
                          background: statusColor.background,
                          border: `1px solid ${statusColor.border}`,
                          borderRadius: 20,
                          padding: "5px 9px",
                          fontSize: 10,
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {statusLabels[roundStatus] ?? roundStatus}
                      </span>
                    </div>

                    <div style={{ minHeight: 55 }}>
                      <h3
                        style={{
                          color: "var(--foreground, #fff)",
                          fontSize: 17,
                          fontWeight: 850,
                          margin: 0,
                          lineHeight: 1.3,
                        }}
                      >
                        {round?.opponentName ?? "Aguardando confronto"}
                      </h3>

                      {round?.opponentTag && (
                        <p
                          style={{
                            color: "var(--muted, #a4adbd)",
                            fontSize: 11,
                            marginTop: 5,
                          }}
                        >
                          {round.opponentTag}
                        </p>
                      )}
                    </div>

                    {hasWar ? (
                      <>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto 1fr",
                            alignItems: "center",
                            gap: 8,
                            textAlign: "center",
                            margin: "19px 0",
                            padding: "17px 10px",
                            borderRadius: 11,
                            background: "rgba(10, 13, 20, 0.25)",
                            border: "1px solid var(--border, #414957)",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                color: "#e7c46d",
                                fontSize: 10,
                                fontWeight: 850,
                                letterSpacing: "0.08em",
                              }}
                            >
                              UPALELE
                            </div>

                            <div
                              style={{
                                color: "#fff",
                                fontSize: 35,
                                fontWeight: 900,
                                lineHeight: 1.2,
                                marginTop: 5,
                              }}
                            >
                              {round?.clanStars ?? 0}
                            </div>
                            <div
                              style={{
                                color: "#929cac",
                                fontSize: 10,
                              }}
                            >
                              ESTRELAS
                            </div>
                          </div>

                          <span
                            style={{
                              color: "#778294",
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            VS
                          </span>

                          <div>
                            <div
                              style={{
                                color: "#aeb8c8",
                                fontSize: 10,
                                fontWeight: 850,
                                letterSpacing: "0.08em",
                              }}
                            >
                              ADVERSÁRIO
                            </div>

                            <div
                              style={{
                                color: "#fff",
                                fontSize: 35,
                                fontWeight: 900,
                                lineHeight: 1.2,
                                marginTop: 5,
                              }}
                            >
                              {round?.opponentStars ?? 0}
                            </div>
                            <div
                              style={{
                                color: "#929cac",
                                fontSize: 10,
                              }}
                            >
                              ESTRELAS
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 8,
                            color: "var(--muted, #a4adbd)",
                            fontSize: 11,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <span>Tamanho da guerra</span>
                            <strong style={{ color: "var(--foreground, #fff)" }}>
                              {round?.teamSize ?? "—"} jogadores
                            </strong>
                          </div>

                          {round?.warStart && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <span>Início</span>
                              <strong style={{ color: "var(--foreground, #fff)" }}>
                                {formatDate(round.warStart)}
                              </strong>
                            </div>
                          )}

                          {round?.warEnd && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <span>Encerramento</span>
                              <strong style={{ color: "var(--foreground, #fff)" }}>
                                {formatDate(round.warEnd)}
                              </strong>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          marginTop: 16,
                          padding: "20px 13px",
                          borderRadius: 11,
                          border: "1px dashed var(--border, #414957)",
                          background: "rgba(10, 13, 20, 0.16)",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            color: "#8994a5",
                            fontSize: 23,
                            marginBottom: 7,
                          }}
                        >
                          ⚔
                        </div>

                        <p
                          style={{
                            color: "var(--muted, #a4adbd)",
                            fontSize: 12,
                            margin: 0,
                            lineHeight: 1.6,
                          }}
                        >
                          Os dados deste confronto ainda não estão disponíveis.
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
