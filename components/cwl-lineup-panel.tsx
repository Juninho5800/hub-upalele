
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Round = {
  id: string;
  roundNumber: number;
  status: string;
  opponentName: string | null;
};

type Participant = {
  id: string;
  player_tag: string;
  player_name: string;
  town_hall_level: number | null;
  selection_position: number | null;
  initial_role: string | null;
  attacks_count: number | null;
  total_stars: number | null;
  average_stars: number | null;
  average_destruction: number | null;
  selection_score: number | null;
};

type Lineup = {
  id: string;
  participant_id: string;
  role: "starter" | "reserve";
  slot_position: number;
  status: "active" | "inactive";
};

type LineupResponse = {
  round: Round | null;
  participants: Participant[];
  lineups: Lineup[];
  error?: string;
};

const panelStyle = {
  background: "var(--card, #222630)",
  border: "1px solid var(--border, #414957)",
  borderRadius: 15,
  padding: 18,
} as const;

const inputStyle = {
  width: "100%",
  minWidth: 0,
  padding: "12px 14px",
  borderRadius: 9,
  border: "1px solid var(--border, #414957)",
  background: "var(--background, #171b23)",
  color: "var(--foreground, #fff)",
  fontSize: 13,
  outline: "none",
} as const;

const primaryButton = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 9,
  padding: "11px 16px",
  background: "linear-gradient(135deg, #b52e43, #e04b60)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
} as const;

const secondaryButton = {
  border: "1px solid var(--border, #414957)",
  borderRadius: 8,
  padding: "8px 11px",
  background: "rgba(255,255,255,0.04)",
  color: "var(--foreground, #fff)",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
} as const;

export function CwlLineupPanel({ canManage }: { canManage: boolean }) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundId, setRoundId] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [reserves, setReserves] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const loadRounds = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/cwl/overview", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Não foi possível carregar as rodadas."
        );
      }

      const availableRounds: Round[] = result.rounds ?? [];

      setRounds(availableRounds);

      if (availableRounds.length > 0) {
        setRoundId((current) =>
          availableRounds.some((round) => round.id === current)
            ? current
            : availableRounds[0].id
        );
      } else {
        setRoundId("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar as rodadas."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLineup = useCallback(async (selectedRoundId: string) => {
    if (!selectedRoundId) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/cwl/lineup?roundId=${encodeURIComponent(selectedRoundId)}`,
        { cache: "no-store" }
      );

      const result: LineupResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Não foi possível carregar a escalação."
        );
      }

      const loadedParticipants = result.participants ?? [];
      const activeLineups = (result.lineups ?? []).filter(
        (item) => item.status === "active"
      );

      setParticipants(loadedParticipants);

      if (activeLineups.length > 0) {
        setStarters(
          activeLineups
            .filter((item) => item.role === "starter")
            .sort((a, b) => a.slot_position - b.slot_position)
            .map((item) =>
              loadedParticipants.find(
                (participant) => participant.id === item.participant_id
              )?.player_tag
            )
            .filter((tag): tag is string => Boolean(tag))
        );

        setReserves(
          activeLineups
            .filter((item) => item.role === "reserve")
            .sort((a, b) => a.slot_position - b.slot_position)
            .map((item) =>
              loadedParticipants.find(
                (participant) => participant.id === item.participant_id
              )?.player_tag
            )
            .filter((tag): tag is string => Boolean(tag))
        );
      } else {
        const ordered = [...loadedParticipants].sort((a, b) => {
          const aPosition = a.selection_position ?? Number.MAX_SAFE_INTEGER;
          const bPosition = b.selection_position ?? Number.MAX_SAFE_INTEGER;
          return aPosition - bPosition;
        });

        setStarters(
          ordered
            .filter((player) => player.initial_role === "starter")
            .slice(0, 15)
            .map((player) => player.player_tag)
        );

        setReserves(
          ordered
            .filter((player) => player.initial_role === "reserve")
            .slice(0, 5)
            .map((player) => player.player_tag)
        );
      }

      setReason("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar a escalação."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRounds();
  }, [loadRounds]);

  useEffect(() => {
    if (roundId) {
      void loadLineup(roundId);
    }
  }, [roundId, loadLineup]);

  const selectedTags = useMemo(
    () => new Set([...starters, ...reserves]),
    [starters, reserves]
  );

  const availableParticipants = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");

    return participants
      .filter((player) => !selectedTags.has(player.player_tag))
      .filter(
        (player) =>
          !term ||
          player.player_name.toLocaleLowerCase("pt-BR").includes(term) ||
          player.player_tag.toLocaleLowerCase("pt-BR").includes(term)
      )
      .sort((a, b) => {
        const aPosition = a.selection_position ?? Number.MAX_SAFE_INTEGER;
        const bPosition = b.selection_position ?? Number.MAX_SAFE_INTEGER;
        return aPosition - bPosition;
      });
  }, [participants, search, selectedTags]);

  const currentRound = rounds.find((round) => round.id === roundId);

  function addStarter(tag: string) {
    if (!canManage || selectedTags.has(tag) || starters.length >= 15) return;
    setStarters((current) => [...current, tag]);
  }

  function addReserve(tag: string) {
    if (!canManage || selectedTags.has(tag) || reserves.length >= 5) return;
    setReserves((current) => [...current, tag]);
  }

  function removePlayer(tag: string) {
    if (!canManage) return;
    setStarters((current) => current.filter((item) => item !== tag));
    setReserves((current) => current.filter((item) => item !== tag));
  }

  async function saveLineup() {
    if (!canManage) return;

    setError("");
    setMessage("");

    if (!roundId) {
      setError("Selecione uma rodada.");
      return;
    }

    if (starters.length !== 15 || reserves.length !== 5) {
      setError("Complete os 15 titulares e as 5 reservas antes de salvar.");
      return;
    }

    if (new Set([...starters, ...reserves]).size !== 20) {
      setError("Um jogador não pode ocupar duas posições.");
      return;
    }

    if (reason.trim().length < 5) {
      setError("Informe uma justificativa com pelo menos 5 caracteres.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/cwl/lineup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId,
          starters,
          reserves,
          reason: reason.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Não foi possível salvar a escalação."
        );
      }

      await loadLineup(roundId);
      setMessage(result.message || "Escalação salva com sucesso.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar a escalação."
      );
    } finally {
      setSaving(false);
    }
  }

  function getPlayer(tag: string) {
    return participants.find((player) => player.player_tag === tag);
  }

  const lineupComplete = starters.length === 15 && reserves.length === 5;
  const availableCount = participants.length - selectedTags.size;

  function renderPlayerCard(tag: string, index: number, role: "starter" | "reserve") {
    const player = getPlayer(tag);
    const accent = role === "starter" ? "#e7c46d" : "#8ebaff";

    return (
      <div
        key={tag}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "11px 12px",
          borderRadius: 10,
          background: "rgba(10,13,20,0.22)",
          border: "1px solid var(--border, #414957)",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <div
            style={{
              width: 31,
              height: 31,
              flex: "0 0 31px",
              display: "grid",
              placeItems: "center",
              borderRadius: 9,
              color: accent,
              background: `${accent}18`,
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: "var(--foreground, #fff)",
                fontSize: 13,
                fontWeight: 800,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {player?.player_name ?? tag}
            </div>

            <div
              style={{
                color: "var(--muted, #a4adbd)",
                fontSize: 10,
                marginTop: 3,
              }}
            >
              {player?.town_hall_level
                ? `CV ${player.town_hall_level}`
                : "CV não informado"}
              {" · "}
              {tag}
            </div>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => removePlayer(tag)}
          disabled={saving}
          style={{
            ...secondaryButton,
            flexShrink: 0,
            opacity: saving ? 0.5 : 1,
          }}
        >
            Remover
          </button>
        )}
      </div>
    );
  }

  function renderRoster(
    title: string,
    subtitle: string,
    players: string[],
    limit: number,
    role: "starter" | "reserve"
  ) {
    const accent = role === "starter" ? "#e7c46d" : "#8ebaff";
    const percentage = (players.length / limit) * 100;

    return (
      <section style={panelStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 5,
          }}
        >
          <div>
            <h3
              style={{
                color: "var(--foreground, #fff)",
                fontSize: 16,
                fontWeight: 850,
                margin: 0,
              }}
            >
              {title}
            </h3>
            <p
              style={{
                color: "var(--muted, #a4adbd)",
                fontSize: 11,
                margin: "4px 0 0",
              }}
            >
              {subtitle}
            </p>
          </div>

          <div
            style={{
              color: accent,
              fontSize: 17,
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            {players.length}
            <span style={{ color: "var(--muted, #a4adbd)", fontSize: 12 }}>
              /{limit}
            </span>
          </div>
        </div>

        <div
          style={{
            height: 6,
            borderRadius: 20,
            overflow: "hidden",
            background: "rgba(150,160,180,0.16)",
            margin: "15px 0",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percentage}%`,
              background: accent,
              borderRadius: 20,
              transition: "width 180ms ease",
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {players.map((tag, index) =>
            renderPlayerCard(tag, index, role)
          )}

          {players.length === 0 && (
            <div
              style={{
                padding: 22,
                textAlign: "center",
                color: "var(--muted, #a4adbd)",
                fontSize: 12,
                border: "1px dashed var(--border, #414957)",
                borderRadius: 10,
              }}
            >
              Nenhum jogador selecionado.
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20, minWidth: 0, marginTop: 22 }}>
      {/* CABEÇALHO */}
      <section
        style={{
          ...panelStyle,
          background:
            "linear-gradient(120deg, #202630 0%, #29232b 65%, #38232b 100%)",
          borderColor: "rgba(212,175,55,0.25)",
          padding: 24,
        }}
      >
        <div
          style={{
            color: "#e7c46d",
            fontSize: 10,
            fontWeight: 850,
            letterSpacing: "0.14em",
            marginBottom: 8,
          }}
        >
          UPALELE · GESTÃO COMPETITIVA
        </div>

        <h2
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: 850,
            letterSpacing: "-0.035em",
            margin: "0 0 7px",
          }}
        >
          Escalação da CWL
        </h2>

        <p style={{ color: "#b8c0ce", fontSize: 13, margin: 0 }}>
          Monte o elenco de cada rodada: 15 titulares e 5 reservas.
        </p>
      </section>

      {!canManage && (
        <section
          style={{
            ...panelStyle,
            borderColor: "rgba(142,186,255,0.25)",
            color: "var(--muted, #a4adbd)",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "#8ebaff" }}>Modo de visualização</strong>
          <div>
            Você pode consultar os titulares, reservas e participantes desta rodada.
            A edição da escalação é exclusiva da liderança.
          </div>
        </section>
      )}

      {/* MENSAGENS */}
      {error && (
        <div
          role="alert"
          style={{
            ...panelStyle,
            color: "#ff9292",
            borderColor: "rgba(230,90,90,0.4)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          style={{
            ...panelStyle,
            color: "#82d9a6",
            borderColor: "rgba(80,190,130,0.35)",
            fontSize: 13,
          }}
        >
          ✓ {message}
        </div>
      )}

      {loading && (
        <div style={panelStyle}>
          <p style={{ color: "var(--muted, #a4adbd)", margin: 0 }}>
            Carregando escalação...
          </p>
        </div>
      )}

      {!loading && rounds.length === 0 && (
        <div style={{ ...panelStyle, textAlign: "center", padding: 30 }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>⚔</div>
          <h3 style={{ color: "var(--foreground, #fff)", margin: "0 0 7px" }}>
            Nenhuma rodada cadastrada
          </h3>
          <p style={{ color: "var(--muted, #a4adbd)", fontSize: 12, margin: 0 }}>
            Sincronize a temporada CWL para liberar a gestão de elenco.
          </p>
        </div>
      )}

      {!loading && rounds.length > 0 && (
        <>
          {/* SELEÇÃO DA RODADA */}
          <section style={panelStyle}>
            <div
              style={{
                color: "#e7c46d",
                fontSize: 10,
                fontWeight: 850,
                letterSpacing: "0.12em",
                marginBottom: 12,
              }}
            >
              CONFIGURAÇÃO DA RODADA
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 15,
                alignItems: "end",
              }}
            >
              <div>
                <label
                  htmlFor="cwl-round-select"
                  style={{
                    display: "block",
                    color: "var(--muted, #a4adbd)",
                    fontSize: 11,
                    fontWeight: 750,
                    marginBottom: 7,
                  }}
                >
                  Rodada da liga
                </label>

                <select
                  id="cwl-round-select"
                  style={inputStyle}
                  value={roundId}
                  disabled={saving}
                  onChange={(event) => setRoundId(event.target.value)}
                >
                  {rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      Rodada {round.roundNumber}
                      {round.opponentName ? ` · ${round.opponentName}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  padding: "11px 13px",
                  borderRadius: 9,
                  background: "rgba(212,175,55,0.07)",
                  border: "1px solid rgba(212,175,55,0.18)",
                }}
              >
                <div
                  style={{
                    color: "#a4adbd",
                    fontSize: 10,
                    fontWeight: 750,
                    marginBottom: 4,
                  }}
                >
                  ADVERSÁRIO
                </div>
                <strong style={{ color: "var(--foreground, #fff)", fontSize: 13 }}>
                  {currentRound?.opponentName ?? "Aguardando adversário"}
                </strong>
              </div>
            </div>
          </section>

          {participants.length === 0 ? (
            <section style={panelStyle}>
              <p style={{ color: "var(--muted, #a4adbd)", fontSize: 13, margin: 0 }}>
                Ainda não há participantes cadastrados nesta temporada.
                Verifique a sincronização da CWL.
              </p>
            </section>
          ) : (
            <>
              {/* RESUMO DO ELENCO */}
              <section
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))",
                  gap: 11,
                }}
              >
                {[
                  {
                    label: "TITULARES",
                    value: `${starters.length}/15`,
                    color: "#e7c46d",
                  },
                  {
                    label: "RESERVAS",
                    value: `${reserves.length}/5`,
                    color: "#8ebaff",
                  },
                  {
                    label: "DISPONÍVEIS",
                    value: String(availableCount),
                    color: "#82d9a6",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      ...panelStyle,
                      padding: 15,
                    }}
                  >
                    <div
                      style={{
                        color: "var(--muted, #a4adbd)",
                        fontSize: 10,
                        fontWeight: 850,
                        letterSpacing: "0.1em",
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        color: item.color,
                        fontSize: 27,
                        fontWeight: 900,
                        marginTop: 5,
                      }}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </section>

              {/* TITULARES E RESERVAS */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 15,
                }}
              >
                {renderRoster(
                  "Titulares",
                  "Equipe principal · 15 vagas",
                  starters,
                  15,
                  "starter"
                )}

                {renderRoster(
                  "Reservas",
                  "Jogadores de substituição · 5 vagas",
                  reserves,
                  5,
                  "reserve"
                )}
              </div>

              {/* JOGADORES DISPONÍVEIS */}
              <section style={panelStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                    marginBottom: 15,
                  }}
                >
                  <div>
                    <h3
                      style={{
                        color: "var(--foreground, #fff)",
                        fontSize: 17,
                        fontWeight: 850,
                        margin: 0,
                      }}
                    >
                      Banco de jogadores
                    </h3>
                    <p
                      style={{
                        color: "var(--muted, #a4adbd)",
                        fontSize: 11,
                        margin: "5px 0 0",
                      }}
                    >
                      {canManage
                        ? "Adicione participantes à equipe da rodada."
                        : "Consulte os participantes que ainda não estão escalados."}
                    </p>
                  </div>

                  <span
                    style={{
                      color: "#82d9a6",
                      background: "rgba(50,180,110,0.1)",
                      border: "1px solid rgba(50,180,110,0.25)",
                      borderRadius: 20,
                      padding: "6px 10px",
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {availableCount} DISPONÍVEIS
                  </span>
                </div>

                <input
                  style={inputStyle}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="⌕  Buscar jogador por nome ou tag..."
                  aria-label="Buscar participantes"
                />

                <div
                  style={{
                    display: "grid",
                    gap: 9,
                    marginTop: 13,
                    maxHeight: 460,
                    overflowY: "auto",
                    paddingRight: 3,
                  }}
                >
                  {availableParticipants.map((player) => (
                    <div
                      key={player.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                        padding: 12,
                        borderRadius: 10,
                        border: "1px solid var(--border, #414957)",
                        background: "rgba(10,13,20,0.18)",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: "1 1 150px" }}>
                        <strong
                          style={{
                            color: "var(--foreground, #fff)",
                            fontSize: 13,
                          }}
                        >
                          {player.player_name}
                        </strong>

                        <div
                          style={{
                            color: "var(--muted, #a4adbd)",
                            fontSize: 10,
                            marginTop: 5,
                          }}
                        >
                          {player.player_tag}
                          {player.town_hall_level
                            ? ` · CV ${player.town_hall_level}`
                            : ""}
                          {player.selection_position
                            ? ` · Posição mensal ${player.selection_position}`
                            : ""}
                        </div>
                      </div>

                      {canManage && (
                        <div style={{ display: "flex", gap: 7 }}>
                        <button
                          type="button"
                          disabled={saving || starters.length >= 15}
                          onClick={() => addStarter(player.player_tag)}
                          style={{
                            ...secondaryButton,
                            color: "#e7c46d",
                            borderColor: "rgba(212,175,55,0.3)",
                            opacity: saving || starters.length >= 15 ? 0.4 : 1,
                          }}
                        >
                          + Titular
                        </button>

                        <button
                          type="button"
                          disabled={saving || reserves.length >= 5}
                          onClick={() => addReserve(player.player_tag)}
                          style={{
                            ...secondaryButton,
                            color: "#8ebaff",
                            borderColor: "rgba(90,150,240,0.3)",
                            opacity: saving || reserves.length >= 5 ? 0.4 : 1,
                          }}
                        >
                          + Reserva
                        </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {availableParticipants.length === 0 && (
                    <p
                      style={{
                        color: "var(--muted, #a4adbd)",
                        padding: 20,
                        textAlign: "center",
                        fontSize: 12,
                      }}
                    >
                      Nenhum jogador disponível para essa busca.
                    </p>
                  )}
                </div>
              </section>

              {/* JUSTIFICATIVA E SALVAMENTO */}
              {canManage && (
              <section
                style={{
                  ...panelStyle,
                  borderColor: "rgba(212,175,55,0.22)",
                }}
              >
                <div
                  style={{
                    color: "#e7c46d",
                    fontSize: 10,
                    fontWeight: 850,
                    letterSpacing: "0.12em",
                    marginBottom: 10,
                  }}
                >
                  CONFIRMAÇÃO DA ESCALAÇÃO
                </div>

                <label
                  htmlFor="cwl-lineup-reason"
                  style={{
                    display: "block",
                    color: "var(--foreground, #fff)",
                    fontSize: 13,
                    fontWeight: 750,
                    marginBottom: 8,
                  }}
                >
                  Justificativa da escalação
                </label>

                <textarea
                  id="cwl-lineup-reason"
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    minHeight: 85,
                  }}
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ex.: Escalação definida pela liderança para esta rodada."
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    marginTop: 13,
                  }}
                >
                  <span
                    style={{
                      color: "var(--muted, #a4adbd)",
                      fontSize: 10,
                    }}
                  >
                    {reason.length}/500 caracteres · Mínimo de 5
                  </span>

                  <button
                    type="button"
                    onClick={saveLineup}
                    disabled={
                      saving ||
                      !lineupComplete ||
                      reason.trim().length < 5
                    }
                    style={{
                      ...primaryButton,
                      opacity:
                        saving ||
                        !lineupComplete ||
                        reason.trim().length < 5
                          ? 0.45
                          : 1,
                      cursor:
                        saving ||
                        !lineupComplete ||
                        reason.trim().length < 5
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {saving ? "Salvando..." : "✓ Confirmar escalação"}
                  </button>
                </div>

                {!lineupComplete && (
                  <p
                    style={{
                      color: "#e7c46d",
                      fontSize: 11,
                      margin: "12px 0 0",
                    }}
                  >
                    Faltam {15 - starters.length} titulares e{" "}
                    {5 - reserves.length} reservas para completar a escalação.
                  </p>
                )}
              </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
