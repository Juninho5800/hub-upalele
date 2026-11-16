
"use client";

import { useCallback, useEffect, useState } from "react";

type Round = {
  id: string;
  roundNumber: number;
};

type HistoryItem = {
  id: string;
  action_type: string;
  original_substitution_id: string | null;
  outgoing_score: number | null;
  incoming_queue_position: number | null;
  reason: string;
  execution_type: string;
  performed_by: string | null;
  created_at: string;
  outgoing_player: {
    player_name: string;
    player_tag: string;
  } | null;
  incoming_player: {
    player_name: string;
    player_tag: string;
  } | null;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data não disponível";
  }

  return date.toLocaleString("pt-BR");
}

function getActionLabel(action: string) {
  switch (action) {
    case "reversal":
      return "Reversão";
    case "manual_adjustment":
      return "Ajuste manual";
    case "correction":
      return "Correção";
    case "substitution":
    default:
      return "Substituição";
  }
}

export function CwlRotationHistoryPanel() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundId, setRoundId] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRounds = useCallback(async () => {
    try {
      const response = await fetch("/api/cwl/overview", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Erro ao carregar rodadas."
        );
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
        setHistory([]);
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

  const loadHistory = useCallback(async (id: string) => {
    if (!id) {
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/cwl/rotation?roundId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Erro ao carregar histórico."
        );
      }

      setHistory(result.history ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar histórico."
      );
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRounds();
  }, [loadRounds]);

  useEffect(() => {
    if (roundId) {
      void loadHistory(roundId);
    }
  }, [roundId, loadHistory]);

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <div className="section-head">
        <div>
          <span className="badge gold">AUDITORIA</span>
          <h2>Histórico de substituições</h2>
          <p className="muted">
            Registro das movimentações realizadas pela liderança.
          </p>
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => void loadHistory(roundId)}
          disabled={loading || !roundId}
        >
          {loading ? "Carregando..." : "Atualizar"}
        </button>
      </div>

      {rounds.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <label htmlFor="rotation-history-round">
            Rodada
          </label>

          <select
            id="rotation-history-round"
            className="input"
            value={roundId}
            disabled={loading}
            onChange={(event) => setRoundId(event.target.value)}
          >
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                Rodada {round.roundNumber}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {loading && (
        <p className="muted">Carregando histórico...</p>
      )}

      {!loading && rounds.length === 0 && (
        <p className="muted">
          Nenhuma rodada cadastrada nesta temporada.
        </p>
      )}

      {!loading && rounds.length > 0 && history.length === 0 && (
        <p className="muted">
          Nenhuma movimentação registrada nesta rodada.
        </p>
      )}

      {!loading && history.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {history.map((item) => (
            <article
              key={item.id}
              className="stat-card"
              style={{
                display: "grid",
                gap: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <strong>
                  {getActionLabel(item.action_type)}
                </strong>

                <span className="badge">
                  {item.execution_type === "automatic"
                    ? "Automática"
                    : "Manual"}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span className="muted text-xs">Saiu</span>

                  <strong
                    style={{
                      display: "block",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.outgoing_player?.player_name ??
                      "Não informado"}
                  </strong>

                  <span className="muted text-xs">
                    {item.outgoing_player?.player_tag ?? ""}
                  </span>
                </div>

                <strong aria-label="para">→</strong>

                <div style={{ minWidth: 0 }}>
                  <span className="muted text-xs">Entrou</span>

                  <strong
                    style={{
                      display: "block",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.incoming_player?.player_name ??
                      "Não informado"}
                  </strong>

                  <span className="muted text-xs">
                    {item.incoming_player?.player_tag ?? ""}
                  </span>
                </div>
              </div>

              <div>
                <span className="muted text-xs">
                  Justificativa
                </span>

                <p style={{ margin: "4px 0 0" }}>
                  {item.reason || "Sem justificativa registrada."}
                </p>
              </div>

              <div
                className="muted"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  fontSize: 12,
                }}
              >
                <span>
                  Data: {formatDate(item.created_at)}
                </span>

                <span>
                  A+D anterior:{" "}
                  {item.outgoing_score != null
                    ? Number(item.outgoing_score).toFixed(2)
                    : "Não registrado"}
                </span>

                <span>
                  Reserva na fila:{" "}
                  {item.incoming_queue_position ?? "—"}
                </span>

                <span>
                  Responsável:{" "}
                  {item.performed_by
                    ? item.performed_by.slice(0, 8)
                    : "Não identificado"}
                </span>
              </div>

              {item.original_substitution_id && (
                <p
                  className="muted"
                  style={{
                    margin: 0,
                    fontSize: 12,
                    overflowWrap: "anywhere",
                  }}
                >
                  Referência da substituição original:{" "}
                  {item.original_substitution_id}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
