
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

type RaidMember = {
  tag: string;
  name: string;
  attacks: number;
  attackLimit: number;
  bonusAttackLimit: number;
  capitalResourcesLooted: number;
  participated: boolean;
};

type RaidSeason = {
  state: "ended" | "ongoing";
  startTime: string;
  endTime: string;
  capitalTotalLoot: number;
  raidsCompleted: number;
  totalAttacks: number;
  enemyDistrictsDestroyed: number;
  offensiveReward: number;
  defensiveReward: number;
  members?: RaidMember[];
};

type RaidResponse = {
  success: boolean;
  clanTag: string;
  totalSeasons: number;
  totalClanMembers: number;
  seasons: RaidSeason[];
  error?: string;
};

type ActivityTab = "raid" | "games" | "events";

type GamesEdition = {
  id: string;
  name: string;
  target_points: number;
  status: string;
  starts_at: string;
};

type GamesMember = {
  tag: string;
  name: string;
  points: number;
  targetPoints: number;
  progress: number;
  completed: boolean;
};

type GamesResponse = {
  success: boolean;
  edition: GamesEdition | null;
  ranking: GamesMember[];
  totalPoints: number;
  membersAtGoal: number;
  canManage: boolean;
  error?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T/);

  if (!match) return value;

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function EventsContent({
  role,
}: {
  userId: string;
  role: string;
}) {
  const [activeTab, setActiveTab] = useState<ActivityTab>("raid");

  // Estados da Raide
  const [data, setData] = useState<RaidResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");

  // Estados dos Jogos do Clã
  const [gamesData, setGamesData] = useState<GamesResponse | null>(null);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesActionLoading, setGamesActionLoading] = useState(false);
  const [gamesError, setGamesError] = useState("");
  const [gamesMessage, setGamesMessage] = useState("");
  const [gamesName, setGamesName] = useState("");

  const leadership = role === "leader" || role === "co_leader";

  // Consulta da Raide
  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/raid/test", {
        cache: "no-store",
      });

      const result = (await response.json()) as RaidResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Não foi possível carregar a Raide.");
      }

      setData(result);
      setLastUpdate(new Date().toLocaleTimeString("pt-BR"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao consultar a Raide."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Consulta do ranking dos Jogos
  const loadGames = useCallback(async () => {
    setGamesLoading(true);
    setGamesError("");

    try {
      const response = await fetch("/api/clan-games/editions", {
        cache: "no-store",
      });

      const result = (await response.json()) as GamesResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao consultar os Jogos do Clã.");
      }

      setGamesData(result);
    } catch (err) {
      setGamesError(
        err instanceof Error ? err.message : "Erro ao consultar os Jogos."
      );
    } finally {
      setGamesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "games") {
      void loadGames();
    }
  }, [activeTab, loadGames]);

  // Inicia uma nova edição
  const startGamesEdition = async () => {
    if (!leadership) return;

    const defaultName = `Jogos do Clã - ${new Date().toLocaleDateString("pt-BR")}`;

    setGamesActionLoading(true);
    setGamesError("");
    setGamesMessage("");

    try {
      const response = await fetch("/api/clan-games/editions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: gamesName.trim() || defaultName,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Não foi possível iniciar a edição.");
      }

      setGamesMessage(
        `Edição iniciada! ${result.totalMembers} jogadores registrados.`
      );

      setGamesName("");
      await loadGames();
    } catch (err) {
      setGamesError(
        err instanceof Error ? err.message : "Erro ao iniciar edição."
      );
    } finally {
      setGamesActionLoading(false);
    }
  };

  // Atualiza as pontuações
  const refreshGames = async () => {
    if (!leadership) return;

    setGamesActionLoading(true);
    setGamesError("");
    setGamesMessage("");

    try {
      const response = await fetch("/api/clan-games/refresh", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao atualizar pontuações.");
      }

      setGamesMessage(
        `Atualização concluída! ${result.totalMembers} jogadores consultados.`
      );

      await loadGames();
    } catch (err) {
      setGamesError(
        err instanceof Error ? err.message : "Erro ao atualizar pontuações."
      );
    } finally {
      setGamesActionLoading(false);
    }
    };

  
  // FINALIZAR E GERAR RELATÓRIO PDF
  const finishGamesEdition = async () => {
    if (!leadership) return;

    const confirmed = window.confirm(
      "Tem certeza que deseja finalizar os Jogos do Clã? Será feita uma última atualização e o relatório PDF será gerado."
    );

    if (!confirmed) return;

    setGamesActionLoading(true);
    setGamesError("");
    setGamesMessage("");

    try {
      const response = await fetch("/api/clan-games/finish", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao finalizar edição.");
      }

      const report = result.report;
      const edition = result.edition;
      const doc = new jsPDF();

      const date = new Date(
        edition.ends_at
      ).toLocaleDateString("pt-BR");

      // CABEÇALHO
      doc.setFontSize(18);
      doc.text("UPALELE - Jogos do Clã", 14, 20);

      doc.setFontSize(12);
      doc.text(edition.name, 14, 30);

      doc.setFontSize(10);
      doc.text(`Data de encerramento: ${date}`, 14, 38);
      doc.text(
        `Meta individual: ${formatNumber(edition.target_points)} pontos`,
        14,
        45
      );

      doc.text(
        `Concluíram a meta: ${report.totalCompleted}`,
        14,
        54
      );

      doc.text(
        `Não participaram: ${report.totalNotParticipated}`,
        14,
        61
      );

      doc.text(
        `Não atingiram a meta: ${report.totalBelowGoal}`,
        14,
        68
      );

      // PRIMEIRA SEÇÃO: NÃO PARTICIPARAM
      doc.setFontSize(13);
      doc.text("1. Jogadores que não participaram", 14, 82);

      if (report.notParticipated.length > 0) {
        autoTable(doc, {
          startY: 88,
          head: [["Jogador", "Tag", "Pontos"]],
          body: report.notParticipated.map((member: {
            name: string;
            tag: string;
            points: number;
          }) => [
            member.name,
            member.tag,
            formatNumber(member.points),
          ]),
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [153, 27, 27],
          },
        });
      } else {
        doc.setFontSize(10);
        doc.text("Todos os jogadores participaram!", 14, 91);
      }

      // SEGUNDA PÁGINA: NÃO ATINGIRAM A META
      doc.addPage();

      doc.setFontSize(13);
      doc.text("2. Jogadores que não atingiram a meta", 14, 20);

      if (report.belowGoal.length > 0) {
        autoTable(doc, {
          startY: 28,
          head: [["Jogador", "Tag", "Pontos", "Faltaram"]],
          body: report.belowGoal.map((member: {
            name: string;
            tag: string;
            points: number;
            targetPoints: number;
          }) => [
            member.name,
            member.tag,
            formatNumber(member.points),
            formatNumber(member.targetPoints - member.points),
          ]),
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [184, 134, 11],
          },
        });
      } else {
        doc.setFontSize(10);
        doc.text("Todos os jogadores atingiram a meta!", 14, 30);
      }

      // DOWNLOAD DO PDF
      const fileDate = new Date().toISOString().slice(0, 10);

      doc.save(`UPALELE_Jogos_do_Cla_${fileDate}.pdf`);

      setGamesMessage(
        `Edição finalizada! PDF gerado. ${report.totalCompleted} jogadores atingiram a meta.`
      );

      await loadGames();
    } catch (err) {
      setGamesError(
        err instanceof Error ? err.message : "Erro ao finalizar edição."
      );
    } finally {
      setGamesActionLoading(false);
    }
  };


  // Dados da Raide
  const season = data?.seasons[0];
  const members = season?.members ?? [];

  const ranking = useMemo(() => {
    return [...members].sort(
      (a, b) => b.capitalResourcesLooted - a.capitalResourcesLooted
    );
  }, [members]);

  const participants = members.filter((member) => member.attacks > 0);
  const nonParticipants = members.filter((member) => member.attacks === 0);

  const totalMembers = data?.totalClanMembers ?? members.length;
  const totalAttacks = season?.totalAttacks ?? 0;
  const totalLoot = season?.capitalTotalLoot ?? 0;
  const districtsDestroyed = season?.enemyDistrictsDestroyed ?? 0;

  const generateNonParticipantsPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("UPALELE - Relatorio de Raide", 14, 20);

    doc.setFontSize(12);
    doc.text("Membros que nao participaram", 14, 30);

    doc.setFontSize(10);
    doc.text(
      `Data da consulta: ${new Date().toLocaleDateString("pt-BR")}`,
      14,
      40
    );

    doc.text(
      `Total de membros sem participacao: ${nonParticipants.length}`,
      14,
      47
    );

    autoTable(doc, {
      startY: 55,
      head: [["Jogador", "Tag", "Ataques", "Status"]],
      body: nonParticipants.map((member) => [
        member.name,
        member.tag,
        String(member.attacks),
        "Nao participou",
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [45, 55, 72],
      },
    });

    doc.save(
      `UPALELE_Nao_Participantes_${new Date().toISOString().slice(0, 10)}.pdf`
    );
  };

  const tabs: { id: ActivityTab; label: string }[] = [
    { id: "raid", label: "Raide da Capital" },
    { id: "games", label: "Jogos do Clã" },
  ];

  return (
    <>
      <section className="banner">
        <span className="badge gold">UPALELE · ATIVIDADES</span>
        <h2>Central de atividades do clã</h2>
        <p>
          Acompanhe a participação dos membros nas atividades do Clash of Clans.
        </p>
      </section>

      {/* Navegação */}
      <section className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                className="btn"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: selected ? "#b8860b" : "transparent",
                  color: selected ? "#ffffff" : "inherit",
                  border: selected ? "1px solid #b8860b" : "1px solid #777",
                  opacity: selected ? 1 : 0.8,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* RAIDE DA CAPITAL */}
      {activeTab === "raid" && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="section-head">
            <div>
              <h2>Raide da Capital</h2>
              <p>Participação e desempenho dos membros.</p>
            </div>

            <button className="btn" onClick={() => void load()} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar dados"}
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          {loading && !data && (
            <p className="muted">Consultando dados da Raide...</p>
          )}

          {data && season && (
            <>
              <div style={{ marginTop: 16 }}>
                <span className="badge gold">
                  {season.state === "ongoing"
                    ? "Raide em andamento"
                    : "Raide encerrada"}
                </span>

                <p className="muted" style={{ marginTop: 8 }}>
                  {formatDate(season.startTime)} até {formatDate(season.endTime)}
                  {" · Clã "}
                  {data.clanTag}
                </p>
              </div>

              <div className="grid two" style={{ marginTop: 18 }}>
                <div className="card">
                  <small className="muted">Total de membros</small>
                  <h2>{formatNumber(totalMembers)}</h2>
                </div>

                <div className="card">
                  <small className="muted">Participaram</small>
                  <h2 style={{ color: "#16a34a" }}>
                    {formatNumber(participants.length)}
                  </h2>
                </div>

                <div className="card">
                  <small className="muted">Não participaram</small>
                  <h2 style={{ color: "#dc2626" }}>
                    {formatNumber(nonParticipants.length)}
                  </h2>
                </div>

                <div className="card">
                  <small className="muted">Ataques realizados</small>
                  <h2>{formatNumber(totalAttacks)}</h2>
                </div>

                <div className="card">
                  <small className="muted">Recursos saqueados</small>
                  <h2>{formatNumber(totalLoot)}</h2>
                </div>

                <div className="card">
                  <small className="muted">Distritos destruídos</small>
                  <h2>{formatNumber(districtsDestroyed)}</h2>
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <div className="section-head">
                  <div>
                    <h2>Participação dos membros</h2>
                    <p>
                      {participants.length} de {totalMembers} membros participaram.
                    </p>
                  </div>

                  <button
                    className="btn"
                    onClick={generateNonParticipantsPDF}
                    disabled={nonParticipants.length === 0}
                  >
                    Gerar relatório PDF
                  </button>
                </div>

                {ranking.length === 0 ? (
                  <p className="muted">
                    Nenhum dado individual foi retornado pela API.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: 10 }}>#</th>
                          <th style={{ textAlign: "left", padding: 10 }}>Jogador</th>
                          <th style={{ textAlign: "center", padding: 10 }}>Ataques</th>
                          <th style={{ textAlign: "right", padding: 10 }}>Recursos</th>
                          <th style={{ textAlign: "center", padding: 10 }}>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {ranking.map((member, index) => (
                          <tr key={member.tag}>
                            <td style={{ padding: 10 }}>{index + 1}</td>
                            <td style={{ padding: 10 }}>
                              <strong>{member.name}</strong>
                              <br />
                              <small className="muted">{member.tag}</small>
                            </td>
                            <td style={{ textAlign: "center", padding: 10 }}>
                              {member.attacks}/
                              {member.attackLimit + member.bonusAttackLimit}
                            </td>
                            <td style={{ textAlign: "right", padding: 10 }}>
                              {formatNumber(member.capitalResourcesLooted)}
                            </td>
                            <td style={{ textAlign: "center", padding: 10 }}>
                              {member.attacks > 0 ? (
                                <span className="badge" style={{ color: "#16a34a" }}>
                                  Participou
                                </span>
                              ) : (
                                <span className="badge" style={{ color: "#dc2626" }}>
                                  Não participou
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <p className="muted" style={{ marginTop: 16 }}>
                Última consulta: {lastUpdate}
              </p>
            </>
          )}

          {data && !season && (
            <p className="muted">Nenhuma temporada de Raide foi encontrada.</p>
          )}
        </section>
      )}

      {/* JOGOS DO CLÃ */}
      {activeTab === "games" && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="section-head">
            <div>
              <h2>Jogos do Clã</h2>
              <p>
                Acompanhamento automático da conquista Campeão dos Jogos.
              </p>
            </div>

            <button
              className="btn"
              onClick={() => void loadGames()}
              disabled={gamesLoading || gamesActionLoading}
            >
              {gamesLoading ? "Carregando..." : "Recarregar painel"}
            </button>
          </div>

          {gamesError && <p className="error">{gamesError}</p>}

          {gamesMessage && (
            <p style={{ color: "#16a34a", marginTop: 12 }}>
              {gamesMessage}
            </p>
          )}

          {gamesLoading && !gamesData && (
            <p className="muted">Consultando Jogos do Clã...</p>
          )}

          {gamesData && !gamesData.edition && (
            <div className="card" style={{ marginTop: 18 }}>
              <span className="badge">Nenhuma edição ativa</span>
              <h3 style={{ marginTop: 12 }}>Iniciar Jogos do Clã</h3>
              <p className="muted">
                Ao iniciar, o sistema registrará a pontuação inicial de cada
                jogador encontrado no clã.
              </p>

              {leadership ? (
                <>
                  <label className="field-label" style={{ display: "block", marginTop: 16 }}>
                    Nome da edição
                  </label>

                  <input
                    className="field"
                    value={gamesName}
                    onChange={(event) => setGamesName(event.target.value)}
                    placeholder="Ex.: Jogos do Clã - Novembro"
                  />

                  <button
                    className="btn"
                    style={{ marginTop: 12 }}
                    onClick={() => void startGamesEdition()}
                    disabled={gamesActionLoading}
                  >
                    {gamesActionLoading ? "Iniciando..." : "Iniciar edição"}
                  </button>
                </>
              ) : (
                <p className="muted" style={{ marginTop: 12 }}>
                  Somente líder e colíderes podem iniciar uma edição.
                </p>
              )}
            </div>
          )}

          {gamesData?.edition && (
            <>
              <div style={{ marginTop: 18 }}>
                <span className="badge gold">Edição em andamento</span>
                <h3 style={{ marginTop: 10 }}>{gamesData.edition.name}</h3>
                <p className="muted">
                  Iniciada em{" "}
                  {new Date(gamesData.edition.starts_at).toLocaleDateString("pt-BR")}
                  {" · Meta individual: "}
                  {formatNumber(gamesData.edition.target_points)} pontos
                </p>
              </div>

              
{gamesData.canManage && (
  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
    <button
      className="btn"
      onClick={() => void refreshGames()}
      disabled={gamesActionLoading || gamesLoading}
    >
      {gamesActionLoading ? "Processando..." : "Atualizar pontuações"}
    </button>

    <button
      className="btn"
      onClick={() => void finishGamesEdition()}
      disabled={gamesActionLoading || gamesLoading}
      style={{
        background: "#991b1b",
        color: "#ffffff",
        border: "1px solid #991b1b",
      }}
    >
      Finalizar edição
    </button>
  </div>
)}


              <div className="grid two" style={{ marginTop: 18 }}>
                <div className="card">
                  <small className="muted">Jogadores registrados</small>
                  <h2>{formatNumber(gamesData.ranking.length)}</h2>
                </div>

                <div className="card">
                  <small className="muted">Pontos conquistados pelo clã</small>
                  <h2>{formatNumber(gamesData.totalPoints)}</h2>
                </div>

                <div className="card">
                  <small className="muted">Jogadores na meta</small>
                  <h2 style={{ color: "#16a34a" }}>
                    {formatNumber(gamesData.membersAtGoal)}
                  </h2>
                </div>

                <div className="card">
                  <small className="muted">Meta individual</small>
                  <h2>{formatNumber(gamesData.edition.target_points)}</h2>
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <h3>Ranking individual</h3>
                <p className="muted">
                  Pontuação conquistada nesta edição.
                </p>

                {gamesData.ranking.length === 0 ? (
                  <p className="muted">Nenhum jogador registrado.</p>
                ) : (
                  <div style={{ overflowX: "auto", marginTop: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: 10 }}>#</th>
                          <th style={{ textAlign: "left", padding: 10 }}>Jogador</th>
                          <th style={{ textAlign: "center", padding: 10 }}>Pontos</th>
                          <th style={{ textAlign: "center", padding: 10 }}>Progresso</th>
                          <th style={{ textAlign: "center", padding: 10 }}>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {gamesData.ranking.map((member, index) => (
                          <tr key={member.tag}>
                            <td style={{ padding: 10 }}>{index + 1}</td>

                            <td style={{ padding: 10 }}>
                              <strong>{member.name}</strong>
                              <br />
                              <small className="muted">{member.tag}</small>
                            </td>

                            <td style={{ textAlign: "center", padding: 10 }}>
                              {formatNumber(member.points)}
                            </td>

                            <td style={{ textAlign: "center", padding: 10, minWidth: 130 }}>
                              <div
                                style={{
                                  background: "#77777733",
                                  borderRadius: 10,
                                  height: 8,
                                  overflow: "hidden",
                                  marginBottom: 5,
                                }}
                              >
                                <div
                                  style={{
                                    width: `${member.progress}%`,
                                    height: "100%",
                                    background: member.completed ? "#16a34a" : "#b8860b",
                                    borderRadius: 10,
                                  }}
                                />
                              </div>
                              <small>{member.progress}%</small>
                            </td>

                            <td style={{ textAlign: "center", padding: 10 }}>
                              {member.completed ? (
                                <span className="badge" style={{ color: "#16a34a" }}>
                                  Concluído
                                </span>
                              ) : member.points > 0 ? (
                                <span className="badge" style={{ color: "#b8860b" }}>
                                  Em andamento
                                </span>
                              ) : (
                                <span className="badge">
                                  Sem pontuação
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {!gamesData.canManage && (
                <p className="muted" style={{ marginTop: 16 }}>
                  As pontuações são atualizadas pela liderança do clã.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* EVENTOS DO CLÃ */}
      {activeTab === "events" && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Eventos do Clã</h2>
          <p className="muted">
            Área destinada à organização e ao acompanhamento dos eventos.
          </p>

          <div className="card" style={{ marginTop: 16 }}>
            <span className="badge">Em desenvolvimento</span>
            <h3 style={{ marginTop: 12 }}>Central de eventos</h3>
            <p className="muted">
              Aqui poderemos cadastrar eventos, informar datas, acompanhar
              participantes e consultar o histórico de atividades.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
