
"use client";

import { useState } from "react";

type Player = {
  playerTag: string;
  playerName: string;
  attacksCount: number;
  totalStars: number;
  averageStars: number;
  averageDestruction: number;
  selectionScore: number;
  selectionPosition: number;
  initialRole: "starter" | "reserve" | "not_selected";
};

type SelectionResponse = {
  success?: boolean;
  blocked?: boolean;
  message?: string;
  error?: string;
  referenceMonth?: string;
  warsAnalyzed?: number;
  attacksAnalyzed?: number;
  incompleteWars?: {
    warId: string;
    warEnd: string | null;
    reason: string;
  }[];
  selection?: {
    players: Player[];
    starters: Player[];
    reserves: Player[];
    tiedGroups: {
      candidates: Player[];
      firstPosition: number;
      lastPosition: number;
    }[];
    boundaryTies: {
      boundaryPosition: number;
      decision: string;
      candidates: Player[];
    }[];
    requiresLeadershipDecision: boolean;
    excludedPlayers: number;
  };
};

const panelStyle: React.CSSProperties = {
  background: "linear-gradient(145deg, #202124, #17181b)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: 22,
  marginTop: 18,
};

const mutedStyle: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 13,
};

function PlayerTable({
  players,
  title,
  role,
}: {
  players: Player[];
  title: string;
  role: string;
}) {
  return (
    <section style={panelStyle}>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">
            {players.length} jogadores classificados
          </p>
        </div>

        <span className="badge gold">{role}</span>
      </div>

      {players.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "#a1a1aa",
          }}
        >
          Nenhum jogador encontrado.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Jogador</th>
                <th>Ataques</th>
                <th>Estrelas</th>
                <th>Média</th>
                <th>Destruição</th>
                <th>Pontuação</th>
              </tr>
            </thead>

            <tbody>
              {players.map((player) => (
                <tr key={player.playerTag}>
                  <td>
                    <strong style={{ color: "#d4af61" }}>
                      {player.selectionPosition}º
                    </strong>
                  </td>

                  <td>
                    <strong>{player.playerName}</strong>
                    <br />
                    <small className="muted">
                      {player.playerTag}
                    </small>
                  </td>

                  <td>{player.attacksCount}</td>
                  <td>{player.totalStars} ★</td>
                  <td>{player.averageStars.toFixed(2)}</td>
                  <td>
                    {(player.averageDestruction * 100).toFixed(1)}%
                  </td>
                  <td>
                    <strong>
                      {player.selectionScore.toFixed(2)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function CwlSelectionPanel() {
  const [month, setMonth] = useState(() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
  });

  const [data, setData] = useState<SelectionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadSelection() {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setError("Selecione um mês de referência válido.");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch(
        `/api/cwl/selection?month=${encodeURIComponent(month)}`,
        { cache: "no-store" }
      );

      const result: SelectionResponse = await response.json();

      setData(result);

      if (!response.ok) {
        throw new Error(
          result.message ||
            result.error ||
            "Não foi possível carregar a seleção."
        );
      }

      if (result.blocked) {
        setError(
          result.message ||
            "A seleção está bloqueada e exige verificação."
        );
        return;
      }

      if (!result.success) {
        throw new Error(
          result.message ||
            result.error ||
            "Não foi possível concluir a seleção."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro de comunicação com o servidor."
      );
    } finally {
      setLoading(false);
    }
  }

  const selection = data?.selection;

  return (
    <div>
      {/* CABEÇALHO */}
      <section
        style={{
          ...panelStyle,
          marginTop: 0,
          background:
            "linear-gradient(120deg, #292326 0%, #1d1d20 55%, #17181b 100%)",
          borderColor: "rgba(212,175,97,0.25)",
        }}
      >
        <div className="section-head">
          <div>
            <span className="badge gold">CWL · SELEÇÃO</span>

            <h2 style={{ fontSize: 25, marginTop: 12 }}>
              Seleção de jogadores
            </h2>

            <p className="muted" style={{ maxWidth: 600 }}>
              Classificação baseada no desempenho individual nas
              guerras normais do mês de referência.
            </p>
          </div>

          <div
            style={{
              fontSize: 38,
              opacity: 0.8,
            }}
          >
            🏆
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "end",
            marginTop: 22,
          }}
        >
          <div>
            <label htmlFor="selection-month">
              Mês de referência
            </label>

            <input
              id="selection-month"
              type="month"
              className="input"
              value={month}
              disabled={loading}
              onChange={(event) => {
                setMonth(event.target.value);
                setData(null);
                setError("");
              }}
              style={{ marginTop: 6, minWidth: 190 }}
            />
          </div>

          <button
            type="button"
            className="btn primary"
            onClick={loadSelection}
            disabled={loading || !month}
          >
            {loading ? "Consultando..." : "Calcular seleção"}
          </button>
        </div>

        <p style={{ ...mutedStyle, marginTop: 14 }}>
          A classificação é uma prévia para análise e revisão da liderança.
        </p>
      </section>

      {/* CARREGAMENTO */}
      {loading && (
        <section style={panelStyle}>
          <p style={{ textAlign: "center", color: "#d4af61" }}>
            Analisando guerras e desempenho dos jogadores...
          </p>
        </section>
      )}

      {/* ERROS */}
      {error && (
        <section
          style={{
            ...panelStyle,
            borderColor: "rgba(239,68,68,0.4)",
          }}
        >
          <div className="section-head">
            <h2>Não foi possível concluir a seleção</h2>
            <span className="badge">Atenção</span>
          </div>

          <p className="error">{error}</p>

          {data?.incompleteWars &&
            data.incompleteWars.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3>Guerras com dados incompletos</h3>

                {data.incompleteWars.map((war) => (
                  <div
                    key={war.warId}
                    style={{
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.035)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <strong>Guerra: {war.warId}</strong>

                    {war.warEnd && (
                      <p className="muted" style={{ marginTop: 6 }}>
                        Encerramento:{" "}
                        {new Date(war.warEnd).toLocaleString("pt-BR")}
                      </p>
                    )}

                    <p className="muted" style={{ marginTop: 6 }}>
                      {war.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
        </section>
      )}

      {/* RESULTADO */}
      {data?.success && selection && (
        <>
          <section style={panelStyle}>
            <div className="section-head">
              <div>
                <span className="badge gold">RESULTADO</span>
                <h2 style={{ marginTop: 10 }}>
                  Classificação do mês
                </h2>
                <p className="muted">
                  Referência: {data.referenceMonth ?? month}
                </p>
              </div>

              <span
                className={`badge ${
                  selection.requiresLeadershipDecision ? "" : "gold"
                }`}
              >
                {selection.requiresLeadershipDecision
                  ? "Aguardando liderança"
                  : "Classificação calculada"}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 12,
                marginTop: 22,
              }}
            >
              {[
                {
                  label: "Guerras analisadas",
                  value: data.warsAnalyzed ?? 0,
                  icon: "⚔️",
                  accent: "#d4af61",
                },
                {
                  label: "Ataques analisados",
                  value: data.attacksAnalyzed ?? 0,
                  icon: "🎯",
                  accent: "#8db7e8",
                },
                {
                  label: "Titulares",
                  value: `${selection.starters.length}/15`,
                  icon: "🛡️",
                  accent: "#d4af61",
                },
                {
                  label: "Reservas",
                  value: `${selection.reserves.length}/5`,
                  icon: "👥",
                  accent: "#a8b4c5",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    minWidth: 0,
                    padding: "17px 18px",
                    borderRadius: 13,
                    background: "linear-gradient(145deg, rgba(255,255,255,0.065), rgba(255,255,255,0.025))",
                    border: "1px solid rgba(255,255,255,0.09)",
                    boxShadow: "0 8px 22px rgba(0,0,0,0.12)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ ...mutedStyle, fontSize: 12 }}>
                      {stat.label}
                    </span>
                    <span aria-hidden="true" style={{ fontSize: 17 }}>
                      {stat.icon}
                    </span>
                  </div>
                  <strong
                    style={{
                      display: "block",
                      color: stat.accent,
                      fontSize: 27,
                      lineHeight: 1.1,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {stat.value}
                  </strong>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: 14,
                marginTop: 16,
              }}
            >
              {[
                {
                  label: "Vagas de titulares",
                  current: selection.starters.length,
                  total: 15,
                  color: "#d4af61",
                  background: "rgba(212,175,97,0.09)",
                },
                {
                  label: "Vagas de reservas",
                  current: selection.reserves.length,
                  total: 5,
                  color: "#a8b4c5",
                  background: "rgba(168,180,197,0.08)",
                },
              ].map((vacancy) => {
                const percentage = Math.min(
                  100,
                  (vacancy.current / vacancy.total) * 100
                );

                return (
                  <div
                    key={vacancy.label}
                    style={{
                      padding: "17px 18px",
                      borderRadius: 13,
                      background: vacancy.background,
                      border: `1px solid ${vacancy.color}40`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 13,
                      }}
                    >
                      <span style={{ ...mutedStyle, color: "#d4d4d8" }}>
                        {vacancy.label}
                      </span>
                      <strong
                        style={{
                          color: vacancy.color,
                          fontSize: 18,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {vacancy.current}/{vacancy.total}
                      </strong>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={vacancy.label}
                      aria-valuemin={0}
                      aria-valuemax={vacancy.total}
                      aria-valuenow={vacancy.current}
                      style={{
                        height: 8,
                        overflow: "hidden",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.10)",
                      }}
                    >
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: vacancy.color,
                          transition: "width 250ms ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* EMPATES */}
          {selection.requiresLeadershipDecision && (
            <section
              style={{
                ...panelStyle,
                borderColor: "rgba(239,68,68,0.45)",
              }}
            >
              <div className="section-head">
                <h2>Empates que exigem decisão</h2>
                <span className="badge">Ação necessária</span>
              </div>

              <p className="error" style={{ marginTop: 12 }}>
                A classificação não deve ser finalizada automaticamente.
                A liderança precisa decidir os casos de empate.
              </p>

              {selection.boundaryTies.map((tie, index) => (
                <div
                  key={`${tie.boundaryPosition}-${index}`}
                  style={{
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <strong>
                    Empate na posição {tie.boundaryPosition}
                  </strong>

                  <p className="muted" style={{ marginTop: 5 }}>
                    {tie.decision}
                  </p>

                  <ul style={{ marginTop: 12, paddingLeft: 20 }}>
                    {tie.candidates.map((player) => (
                      <li
                        key={player.playerTag}
                        style={{ marginBottom: 6 }}
                      >
                        <strong>{player.playerName}</strong>
                        <span className="muted">
                          {" "}— {player.playerTag}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {/* TITULARES */}
          <PlayerTable
            title="Titulares"
            players={selection.starters}
            role="15 VAGAS"
          />

          {/* RESERVAS */}
          <PlayerTable
            title="Reservas"
            players={selection.reserves}
            role="5 VAGAS"
          />

          {/* RESUMO */}
          <section style={panelStyle}>
            <div className="section-head">
              <h2>Resumo da classificação</h2>
              <span className="badge gold">Consolidado</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                padding: 16,
                marginTop: 14,
                borderRadius: 10,
                background: "rgba(255,255,255,0.035)",
              }}
            >
              <span className="muted">Jogadores não selecionados</span>
              <strong style={{ fontSize: 20 }}>
                {selection.excludedPlayers}
              </strong>
            </div>

            <p className="muted" style={{ marginTop: 16, lineHeight: 1.6 }}>
              A classificação exibida ainda não grava nem confirma
              uma escalação definitiva. A liderança deve revisar
              os resultados e confirmar a escalação.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
