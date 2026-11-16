
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Round = {
  id: string;
  roundNumber: number;
  status: string;
  warStatus: string | null;
  opponentName: string | null;
};

type Player = {
  id: string;
  player_name: string;
  player_tag: string;
  town_hall_level: number | null;
  lineup: {
    role: "starter" | "reserve";
    slot_position: number;
    status: "active" | "inactive";
  };
  performance: {
    attack_confirmed: boolean;
    attack_stars: number | null;
    attack_destruction: number | null;
    defense_confirmed: boolean;
    defense_destruction: number | null;
    ad_index: number | null;
    is_protected: boolean;
    data_complete: boolean;
  } | null;
};

type OverviewResponse = {
  rounds?: Round[];
  error?: string;
};

type PerformanceResponse = {
  players?: Player[];
  error?: string;
};

export function CwlRotationPanel({
  canManage,
}: {
  canManage: boolean;
}) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundId, setRoundId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [outgoingId, setOutgoingId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRounds = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/cwl/overview", {
        cache: "no-store",
      });

      const result: OverviewResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar rodadas.");
      }

      const items = result.rounds ?? [];
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
        err instanceof Error ? err.message : "Erro ao carregar rodadas."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlayers = useCallback(async (id: string) => {
    if (!id) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/cwl/performance?roundId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      const result: PerformanceResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar jogadores.");
      }

      setPlayers(result.players ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar jogadores."
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
      setOutgoingId("");
      setReason("");
      setMessage("");
      void loadPlayers(roundId);
    }
  }, [roundId, loadPlayers]);

  const activePlayers = useMemo(
    () => players.filter((player) => player.lineup.status === "active"),
    [players]
  );

  const starters = useMemo(
    () =>
      activePlayers
        .filter((player) => player.lineup.role === "starter")
        .sort(
          (a, b) =>
            a.lineup.slot_position - b.lineup.slot_position
        ),
    [activePlayers]
  );

  const reserves = useMemo(
    () =>
      activePlayers
        .filter((player) => player.lineup.role === "reserve")
        .sort(
          (a, b) =>
            a.lineup.slot_position - b.lineup.slot_position
        ),
    [activePlayers]
  );

  const selectedStarter = starters.find(
    (player) => player.id === outgoingId
  );

  // Apenas jogadores com ataque confirmado de 3 estrelas são protegidos.
  const protectedPlayer = (player: Player) =>
    player.performance?.attack_confirmed === true &&
    player.performance.attack_stars === 3;

  const currentRound = rounds.find((round) => round.id === roundId);
  const nextReserve = reserves[0];

  async function executeSubstitution() {
    setError("");
    setMessage("");

    if (!roundId || !outgoingId || !selectedStarter) {
      setError("Selecione um titular válido para substituição.");
      return;
    }

    if (reserves.length !== 5 || !nextReserve) {
      setError("A rodada precisa ter cinco reservas ativas.");
      return;
    }

    if (protectedPlayer(selectedStarter)) {
      setError("Este jogador está protegido por ter feito três estrelas.");
      return;
    }

    if (reason.trim().length < 5) {
      setError("Informe uma justificativa com pelo menos cinco caracteres.");
      return;
    }

    const confirmed = window.confirm(
      `Confirma a substituição?\n\n` +
      `Sai: ${selectedStarter.player_name}\n` +
      `Entra: ${nextReserve.player_name}\n\n` +
      `O jogador substituído irá para o final da fila de reservas.`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const response = await fetch("/api/cwl/rotation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roundId,
          outgoingParticipantId: outgoingId,
          reason: reason.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Não foi possível realizar a substituição."
        );
      }

      setMessage(
        `${selectedStarter.player_name} foi substituído por ${nextReserve.player_name}.`
      );

      setOutgoingId("");
      setReason("");

      await loadPlayers(roundId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao realizar substituição."
      );
    } finally {
      setSaving(false);
    }
  }

  function renderPlayer(player: Player) {
    const isProtected = protectedPlayer(player);
    const performance = player.performance;
    const complete = performance?.data_complete === true;

    return (
      <div
        key={player.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-white/20"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 font-bold text-gray-300">
            {player.lineup.slot_position}
          </div>

          <div className="min-w-0">
            <strong className="block truncate text-sm text-white">
              {player.player_name}
            </strong>

            <p className="text-xs text-gray-500">
              {player.player_tag}
              {player.town_hall_level
                ? ` · CV ${player.town_hall_level}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <strong className="block text-sm text-gray-200">
              A+D:{" "}
              {performance?.ad_index != null
                ? Number(performance.ad_index).toFixed(2)
                : "—"}
            </strong>

            <span className="text-xs text-gray-500">
              {isProtected
                ? "3 estrelas no ataque"
                : !complete
                  ? "Dados incompletos"
                  : "Dados completos"}
            </span>
          </div>

          {isProtected && (
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-400">
              Protegido
            </span>
          )}
        </div>
      </div>
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
              GESTÃO DE ROTAÇÃO
            </span>

            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Clan War League
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Substituições da CWL
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">
            Gerencie a rotação dos titulares, acompanhe a fila de reservas
            e realize substituições de forma controlada.
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
          <strong className="mb-1 block">Substituição realizada</strong>
          {message}
        </div>
      )}

      {/* Carregamento */}
      {loading && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-gray-700 border-t-red-500" />
          <p className="text-sm text-gray-400">
            Carregando dados da rodada...
          </p>
        </div>
      )}

      {!loading && rounds.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
          <p className="font-semibold text-gray-300">
            Nenhuma rodada cadastrada
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Sincronize a temporada CWL para liberar a gestão de rotação.
          </p>
        </div>
      )}

      {rounds.length > 0 && (
        <>
          {/* Seleção da rodada */}
          <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-2 sm:items-end">
            <div>
              <label
                htmlFor="rotation-round"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                Rodada selecionada
              </label>

              <select
                id="rotation-round"
                className="input"
                value={roundId}
                disabled={saving}
                onChange={(event) => setRoundId(event.target.value)}
              >
                {rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    Rodada {round.roundNumber}
                    {round.opponentName
                      ? ` · ${round.opponentName}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:pb-1">
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Adversário
              </p>
              <p className="mt-1 font-semibold text-white">
                {currentRound?.opponentName ?? "Aguardando adversário"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {currentRound?.warStatus === "in_war"
                  ? "● Guerra em andamento"
                  : currentRound?.warStatus === "ended"
                    ? "● Guerra encerrada"
                    : "● Situação não confirmada"}
              </p>
            </div>
          </div>

          {!loading && (
            <>
              {/* Indicadores */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                    Titulares
                  </p>
                  <strong className="mt-1 block text-2xl font-bold text-white sm:text-3xl">
                    {starters.length}
                    <span className="text-sm font-medium text-gray-500">
                      /15
                    </span>
                  </strong>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{
                        width: `${Math.min((starters.length / 15) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                    Reservas
                  </p>
                  <strong className="mt-1 block text-2xl font-bold text-white sm:text-3xl">
                    {reserves.length}
                    <span className="text-sm font-medium text-gray-500">
                      /5
                    </span>
                  </strong>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{
                        width: `${Math.min((reserves.length / 5) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] to-transparent p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/70 sm:text-xs">
                    Protegidos
                  </p>
                  <strong className="mt-1 block text-2xl font-bold text-amber-400 sm:text-3xl">
                    {starters.filter(protectedPlayer).length}
                  </strong>
                  <p className="mt-2 text-[10px] text-gray-500">
                    3 estrelas no ataque
                  </p>
                </div>
              </div>

              {/* Próxima reserva */}
              {nextReserve ? (
                <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.10] to-transparent p-4 sm:p-5">
                  <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl" />

                  <div className="relative flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-400">
                          Próxima reserva da fila
                        </p>
                      </div>

                      <strong className="block text-xl font-bold text-white">
                        {nextReserve.player_name}
                      </strong>

                      <p className="mt-1 text-xs text-gray-400">
                        Posição {nextReserve.lineup.slot_position}
                        {" · "}
                        {nextReserve.player_tag}
                      </p>
                    </div>

                    <div className="rounded-xl border border-amber-500/20 bg-black/20 px-4 py-3 text-center">
                      <span className="block text-[10px] uppercase tracking-wider text-gray-500">
                        Fila
                      </span>
                      <strong className="text-2xl text-amber-400">
                        01
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">
                  Não há reservas ativas suficientes nesta rodada.
                </div>
              )}

              {/* Listas */}
              <div className="space-y-3">
                <details className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold text-white">
                        Titulares
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Jogadores escalados para a rodada
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-400">
                        {starters.length}/15
                      </span>
                      <span className="text-gray-500 transition group-open:rotate-180">
                        ▼
                      </span>
                    </div>
                  </summary>

                  <div className="space-y-2 border-t border-white/10 p-3">
                    {starters.map(renderPlayer)}
                    {starters.length === 0 && (
                      <p className="p-3 text-sm text-gray-500">
                        Nenhum titular ativo.
                      </p>
                    )}
                  </div>
                </details>

                <details className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold text-white">
                        Fila de reservas
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        A posição 1 é a próxima a entrar
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400">
                        {reserves.length}/5
                      </span>
                      <span className="text-gray-500 transition group-open:rotate-180">
                        ▼
                      </span>
                    </div>
                  </summary>

                  <div className="space-y-2 border-t border-white/10 p-3">
                    {reserves.map(renderPlayer)}
                    {reserves.length === 0 && (
                      <p className="p-3 text-sm text-gray-500">
                        Nenhuma reserva ativa.
                      </p>
                    )}
                  </div>
                </details>
              </div>

              {canManage && (
                /* Substituição manual */
                <div className="overflow-hidden rounded-xl border border-red-500/25 bg-gradient-to-br from-red-500/[0.07] to-transparent">
                  <div className="border-b border-white/10 p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
                        ⇄
                      </span>
                      <div>
                        <h3 className="font-bold text-white">
                          Substituição manual
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          Ação exclusiva da liderança
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-gray-400">
                      A primeira reserva será promovida e o titular substituído
                      irá para o final da fila.
                    </p>
                  </div>

                  <div className="space-y-4 p-4 sm:p-5">
                    {reserves.length === 5 ? (
                      <>
                        <div>
                          <label
                            htmlFor="rotation-outgoing"
                            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400"
                          >
                            Titular que será substituído
                          </label>

                          <select
                            id="rotation-outgoing"
                            className="input"
                            value={outgoingId}
                            disabled={saving}
                            onChange={(event) =>
                              setOutgoingId(event.target.value)
                            }
                          >
                            <option value="">
                              Selecione um titular
                            </option>

                            {starters.map((player) => (
                              <option
                                key={player.id}
                                value={player.id}
                                disabled={protectedPlayer(player)}
                              >
                                {player.lineup.slot_position}.{" "}
                                {player.player_name}
                                {protectedPlayer(player)
                                  ? " · Protegido"
                                  : ""}
                              </option>
                            ))}
                          </select>

                          <p className="mt-2 text-xs text-gray-500">
                            Jogadores com 3 estrelas no ataque não podem ser
                            selecionados.
                          </p>
                        </div>

                        {selectedStarter && (
                          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                              Jogador selecionado
                            </p>

                            <p className="mt-1 font-semibold text-white">
                              {selectedStarter.player_name}
                            </p>

                            {selectedStarter.performance?.data_complete ? (
                              <p className="mt-1 text-xs text-gray-400">
                                Índice A+D atual:{" "}
                                <strong className="text-gray-200">
                                  {selectedStarter.performance.ad_index ?? "—"}
                                </strong>
                              </p>
                            ) : (
                              <p className="mt-2 text-xs leading-relaxed text-amber-400">
                                Dados incompletos. A liderança pode realizar
                                a substituição manual mediante justificativa.
                              </p>
                            )}
                          </div>
                        )}

                        <div>
                          <label
                            htmlFor="rotation-reason"
                            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400"
                          >
                            Justificativa obrigatória
                          </label>

                          <textarea
                            id="rotation-reason"
                            className="input"
                            rows={3}
                            maxLength={500}
                            value={reason}
                            disabled={saving}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Explique o motivo da substituição..."
                          />

                          <div className="mt-2 flex justify-between gap-2">
                            <p className="text-xs text-gray-500">
                              Mínimo de 5 caracteres
                            </p>
                            <p className="text-xs text-gray-500">
                              {reason.length}/500
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn primary w-full"
                          onClick={executeSubstitution}
                          disabled={
                            saving ||
                            !selectedStarter ||
                            reason.trim().length < 5 ||
                            protectedPlayer(selectedStarter)
                          }
                        >
                          {saving
                            ? "Realizando substituição..."
                            : "Confirmar substituição"}
                        </button>
                      </>
                    ) : (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                        <p className="font-semibold text-amber-400">
                          Fila incompleta
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          É necessário ter cinco reservas ativas para realizar
                          uma substituição. Atualmente existem {reserves.length}.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Regra de proteção */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                  Regras de rotação
                </p>

                <ul className="space-y-2 text-xs leading-relaxed text-gray-500">
                  <li>
                    <span className="mr-2 text-amber-400">●</span>
                    Apenas jogadores com ataque confirmado de 3 estrelas
                    possuem proteção contra substituição.
                  </li>
                  <li>
                    <span className="mr-2 text-gray-400">●</span>
                    Jogadores com 0, 1 ou 2 estrelas não possuem essa proteção.
                  </li>
                  <li>
                    <span className="mr-2 text-gray-400">●</span>
                    Dados incompletos não impedem uma substituição manual,
                    desde que exista justificativa.
                  </li>
                  <li>
                    <span className="mr-2 text-gray-400">●</span>
                    O titular substituído passa para o final da fila de reservas.
                  </li>
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
