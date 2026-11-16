
"use client";

import { useCallback, useEffect, useState } from "react";

type Round = {
  id: string;
  roundNumber: number;
  status: string;
  warId: string | null;
  warStatus: string | null;
};

type Player = {
  id: string;
  player_name: string;
  player_tag: string;
  town_hall_level: number | null;
  lineup: {
    role: string;
    slot_position: number;
    status: string;
  };
  performance: {
    attack_confirmed: boolean;
    attack_stars: number | null;
    attack_destruction: number | null;
    defense_confirmed: boolean;
    defense_stars: number | null;
    defense_destruction: number | null;
    attack_index: number | null;
    defense_index: number | null;
    ad_index: number | null;
    is_protected: boolean;
    data_complete: boolean;
    calculated_at: string | null;
  } | null;
};

export function CwlPerformancePanel({
  canManage = false,
}: {
  canManage?: boolean;
}) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundId, setRoundId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRounds = useCallback(async () => {
    try {
      const response = await fetch("/api/cwl/overview", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar rodadas.");
      }

      const items: Round[] = result.rounds ?? [];
      setRounds(items);

      if (items.length > 0) {
        setRoundId((current) =>
          items.some((item) => item.id === current)
            ? current
            : items[0].id
        );
      } else {
        setRoundId("");
        setPlayers([]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar rodadas."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPerformance = useCallback(async (id: string) => {
    if (!id) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/cwl/performance?roundId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Erro ao consultar desempenho."
        );
      }

      setPlayers(result.players ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao consultar desempenho."
      );
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRounds();
  }, [loadRounds]);

  useEffect(() => {
    if (roundId) {
      setMessage("");
      void loadPerformance(roundId);
    }
  }, [roundId, loadPerformance]);

  const currentRound = rounds.find((item) => item.id === roundId);

  const complete = players.filter(
    (player) => player.performance?.data_complete === true
  ).length;

  const pending = players.length - complete;

  const protectedCount = players.filter(
    (player) =>
      player.performance?.attack_confirmed === true &&
      player.performance.attack_stars === 3
  ).length;

  const completionRate =
    players.length > 0
      ? Math.round((complete / players.length) * 100)
      : 0;

  async function processRound() {
    if (!roundId || processing) return;

    if (!currentRound?.warId || currentRound.warStatus !== "ended") {
      setError("Somente uma guerra encerrada e vinculada pode ser processada.");
      return;
    }

    const confirmed = window.confirm(
      "Deseja processar os dados desta rodada?\n\n" +
      "Os resultados de ataques e defesas serão calculados e registrados."
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/cwl/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roundId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Falha ao processar rodada."
        );
      }

      setMessage(
        `Processamento concluído: ${result.completeCount} completos e ${result.pendingCount} pendentes.`
      );

      await loadPerformance(roundId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao processar rodada."
      );
    } finally {
      setProcessing(false);
    }
  }

  function formatPercent(value: number | null | undefined) {
    return value == null ? "—" : `${Number(value).toFixed(1)}%`;
  }

  function formatIndex(value: number | null | undefined) {
    return value == null ? "—" : Number(value).toFixed(1);
  }

  function renderAttack(player: Player) {
    const perf = player.performance;

    if (!perf?.attack_confirmed) return "Pendente";

    return `${perf.attack_stars ?? "—"}★ · ${formatPercent(
      perf.attack_destruction
    )}`;
  }

  function renderDefense(player: Player) {
    const perf = player.performance;

    if (!perf?.defense_confirmed) return "Pendente";

    return `${perf.defense_stars ?? "—"}★ · ${formatPercent(
      perf.defense_destruction
    )}`;
  }

  function isProtected(player: Player) {
    return (
      player.performance?.attack_confirmed === true &&
      player.performance.attack_stars === 3
    );
  }

  function renderStatus(player: Player) {
    const perf = player.performance;

    if (isProtected(player)) {
      return (
        <div className="flex flex-col gap-1">
          <span className="w-fit rounded-md border border-green-500/25 bg-green-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-green-400">
            Protegido
          </span>
          <span className="text-[10px] text-gray-500">
            3 estrelas no ataque
          </span>
        </div>
      );
    }

    if (perf?.data_complete) {
      return (
        <span className="w-fit rounded-md border border-green-500/25 bg-green-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-green-400">
          Completo
        </span>
      );
    }

    return (
      <span className="w-fit rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-400">
        Pendente
      </span>
    );
  }

  return (
    <section
      className="card space-y-6 overflow-hidden"
      style={{ marginTop: 24 }}
    >
      {/* Cabeçalho */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#242424] via-[#171717] to-[#101010] p-5 sm:p-6">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-red-600/10 blur-3xl" />

        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-amber-400">
              ANÁLISE CWL
            </span>

            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />

            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Performance individual
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Desempenho individual · A+D
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">
            Acompanhe os resultados de ataques, defesas e índices individuais
            dos jogadores escalados.
          </p>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <strong className="mb-1 block">Atenção</strong>
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
          <strong className="mb-1 block">Processamento concluído</strong>
          {message}
        </div>
      )}

      {/* Carregamento */}
      {loading && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-gray-700 border-t-red-500" />
          <p className="text-sm text-gray-400">
            Carregando desempenho...
          </p>
        </div>
      )}

      {!loading && rounds.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
          <p className="font-semibold text-gray-300">
            Nenhuma rodada cadastrada
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Sincronize a temporada CWL para liberar a análise de desempenho.
          </p>
        </div>
      )}

      {rounds.length > 0 && (
        <>
          {/* Seleção da rodada e processamento */}
          <div className={`grid gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:items-end ${canManage ? "sm:grid-cols-[1fr_auto]" : ""}`}>
            <div>
              <label
                htmlFor="performance-round"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                Rodada selecionada
              </label>

              <select
                id="performance-round"
                className="input"
                value={roundId}
                disabled={processing}
                onChange={(event) => setRoundId(event.target.value)}
              >
                {rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    Rodada {round.roundNumber}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-gray-500">
                {currentRound?.warStatus === "ended"
                  ? "Guerra encerrada · Dados disponíveis para análise"
                  : currentRound?.warStatus === "in_war"
                    ? "Guerra em andamento"
                    : "Aguardando confirmação do status da guerra"}
              </p>
            </div>

            {canManage && (
              <button
                type="button"
                className="btn primary w-full sm:w-auto"
                onClick={processRound}
                disabled={
                  processing ||
                  loading ||
                  !currentRound?.warId ||
                  currentRound?.warStatus !== "ended"
                }
                title={
                  currentRound?.warStatus !== "ended"
                    ? "O processamento exige uma guerra encerrada."
                    : ""
                }
              >
                {processing
                  ? "Processando..."
                  : "Processar desempenho"}
              </button>
            )}
          </div>

          {!loading && (
            <>
              {/* Indicadores */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                    Na escalação
                  </p>
                  <strong className="mt-1 block text-2xl font-bold text-white sm:text-3xl">
                    {players.length}
                  </strong>
                  <p className="mt-2 text-[10px] text-gray-500">
                    Jogadores
                  </p>
                </div>

                <div className="rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/[0.08] to-transparent p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-green-500/70 sm:text-xs">
                    Completos
                  </p>
                  <strong className="mt-1 block text-2xl font-bold text-green-400 sm:text-3xl">
                    {complete}
                  </strong>
                  <p className="mt-2 text-[10px] text-gray-500">
                    Dados registrados
                  </p>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] to-transparent p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/70 sm:text-xs">
                    Pendentes
                  </p>
                  <strong className="mt-1 block text-2xl font-bold text-amber-400 sm:text-3xl">
                    {pending}
                  </strong>
                  <p className="mt-2 text-[10px] text-gray-500">
                    Dados incompletos
                  </p>
                </div>
              </div>

              {/* Progresso */}
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Progresso dos dados
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Percentual de jogadores com desempenho completo
                    </p>
                  </div>

                  <strong className="text-lg text-white">
                    {completionRate}%
                  </strong>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500">
                  <span>{complete} completos</span>
                  <span>{pending} pendentes</span>
                </div>
              </div>

              {/* Protegidos */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
                <div>
                  <p className="text-sm font-semibold text-amber-300">
                    Jogadores protegidos
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Ataque confirmado com 3 estrelas
                  </p>
                </div>

                <div className="rounded-lg border border-amber-500/20 bg-black/20 px-4 py-2">
                  <strong className="text-2xl text-amber-400">
                    {protectedCount}
                  </strong>
                </div>
              </div>

              {!loading && currentRound?.warStatus !== "ended" && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-gray-400">
                  O processamento ficará disponível quando a guerra estiver
                  encerrada e sincronizada.
                </div>
              )}

              {/* Tabela */}
              {players.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
                  <p className="font-semibold text-gray-300">
                    Nenhum jogador na escalação
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    Não existem jogadores cadastrados nesta rodada.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <div className="border-b border-white/10 bg-white/[0.03] p-4">
                    <h3 className="font-bold text-white">
                      Desempenho dos jogadores
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Ataques, defesas e índices individuais
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        minWidth: 850,
                      }}
                    >
                      <thead>
                        <tr className="bg-black/20">
                          {[
                            "Jogador",
                            "Função",
                            "Ataque",
                            "Defesa",
                            "Índice A",
                            "Índice D",
                            "A+D",
                            "Situação",
                          ].map((heading) => (
                            <th
                              key={heading}
                              className="text-[10px] font-bold uppercase tracking-wider text-gray-500"
                              style={{
                                textAlign: "left",
                                padding: 13,
                                borderBottom: "1px solid rgba(255,255,255,0.08)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {players.map((player) => {
                          const perf = player.performance;

                          return (
                            <tr
                              key={player.id}
                              className="transition hover:bg-white/[0.035]"
                              style={{
                                borderBottom: "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
                              <td style={{ padding: 13 }}>
                                <strong className="block text-sm text-white">
                                  {player.player_name}
                                </strong>
                                <div className="mt-1 text-[10px] text-gray-500">
                                  {player.player_tag}
                                  {player.town_hall_level
                                    ? ` · CV ${player.town_hall_level}`
                                    : ""}
                                </div>
                              </td>

                              <td style={{ padding: 13, whiteSpace: "nowrap" }}>
                                <span
                                  className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                                    player.lineup.role === "starter"
                                      ? "border border-red-500/20 bg-red-500/10 text-red-300"
                                      : "border border-amber-500/20 bg-amber-500/10 text-amber-300"
                                  }`}
                                >
                                  {player.lineup.role === "starter"
                                    ? `Titular ${player.lineup.slot_position}`
                                    : `Reserva ${player.lineup.slot_position}`}
                                </span>
                              </td>

                              <td style={{ padding: 13, whiteSpace: "nowrap" }}>
                                <span
                                  className={
                                    perf?.attack_confirmed
                                      ? "text-sm font-medium text-gray-200"
                                      : "text-xs text-gray-500"
                                  }
                                >
                                  {renderAttack(player)}
                                </span>
                              </td>

                              <td style={{ padding: 13, whiteSpace: "nowrap" }}>
                                <span
                                  className={
                                    perf?.defense_confirmed
                                      ? "text-sm font-medium text-gray-200"
                                      : "text-xs text-gray-500"
                                  }
                                >
                                  {renderDefense(player)}
                                </span>
                              </td>

                              <td style={{ padding: 13 }}>
                                <span className="text-sm text-gray-300">
                                  {formatIndex(perf?.attack_index)}
                                </span>
                              </td>

                              <td style={{ padding: 13 }}>
                                <span className="text-sm text-gray-300">
                                  {formatIndex(perf?.defense_index)}
                                </span>
                              </td>

                              <td style={{ padding: 13 }}>
                                <strong className="text-sm text-white">
                                  {formatIndex(perf?.ad_index)}
                                </strong>
                              </td>

                              <td style={{ padding: 13 }}>
                                {renderStatus(player)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
