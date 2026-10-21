
"use client";

import { useCallback, useEffect, useState } from "react";

type Member = {
  tag: string;
  name: string;
  townhallLevel?: number;
  mapPosition?: number;
  opponentAttacks?: number;
  attacks?: { stars: number; destructionPercentage: number }[];
};

type WarData = {
  connected?: boolean;
  inWar?: boolean;
  message?: string;
  state?: string;
  teamSize?: number;
  attacksPerMember?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  clan?: {
    name: string;
    tag: string;
    stars: number;
    destructionPercentage: number;
    attacks: number;
    members: Member[];
  } | null;
  opponent?: {
    name: string;
    tag: string;
    stars: number;
    destructionPercentage: number;
    attacks: number;
    members: Member[];
  } | null;
  error?: string;
  details?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "A definir";

  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/
  );

  if (!match) return value;

  const [, y, m, d, h, min, sec] = match;

  return new Date(
    `${y}-${m}-${d}T${h}:${min}:${sec}Z`
  ).toLocaleString("pt-BR");
}

function formatLocalDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

const stateLabels: Record<string, string> = {
  preparation: "Preparação",
  inWar: "Em guerra",
  warEnded: "Guerra encerrada",
  notInWar: "Sem guerra ativa",
};

export function WarRoomLive() {
  const [war, setWar] = useState<WarData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const loadWar = useCallback(async () => {
    try {
      const response = await fetch("/api/clash/current-war", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.details ||
            result.error ||
            "Falha ao consultar a guerra."
        );
      }

      setWar(result);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar a guerra."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWar();

    const interval = setInterval(() => {
      void loadWar();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadWar]);

  async function syncWar() {
    if (syncing) return;

    setSyncing(true);
    setSyncMessage("");
    setSyncError(false);

    try {
      const response = await fetch("/api/clash/sync", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.details ||
            result.error ||
            result.message ||
            `Falha na sincronização (HTTP ${response.status}).`
        );
      }

      setLastSyncedAt(new Date().toISOString());
      setSyncMessage("Guerra sincronizada com sucesso!");
      await loadWar();
    } catch (err) {
      setSyncError(true);
      setSyncMessage(
        err instanceof Error
          ? err.message
          : "Não foi possível sincronizar a guerra."
      );
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <section className="card">
        <p>Carregando guerra da API...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card">
        <h2>Guerra ao vivo</h2>
        <p className="error">{error}</p>
        <button
          className="btn primary"
          onClick={() => void loadWar()}
        >
          Tentar novamente
        </button>
      </section>
    );
  }

  const syncControls = (
    <div>
      <button
        className="btn primary"
        onClick={() => void syncWar()}
        disabled={syncing}
        aria-busy={syncing}
      >
        {syncing ? "Sincronizando..." : "Sincronizar guerra"}
      </button>

      {syncMessage && (
        <p
          role="status"
          aria-live="polite"
          className={syncError ? "error" : ""}
        >
          {syncMessage}
        </p>
      )}

      {lastSyncedAt && (
        <p className="muted">
          Última sincronização manual:{" "}
          {formatLocalDate(lastSyncedAt)}
        </p>
      )}
    </div>
  );

  if (!war?.inWar || !war.clan || !war.opponent) {
    return (
      <section className="card">
        <div className="section-head">
          <div>
            <span className="badge gold">API CLASH OF CLANS</span>
            <h2>Guerra ao vivo</h2>
          </div>
          <span className="badge">
            {stateLabels[war?.state || ""] || war?.state || "Indisponível"}
          </span>
        </div>

        <p>
          {war?.message ||
            "Não há dados de uma guerra ativa disponíveis."}
        </p>

        {syncControls}
      </section>
    );
  }

  const sides = [
    { data: war.clan, label: "Nosso clã" },
    { data: war.opponent, label: "Adversário" },
  ];

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <span className="badge gold">API CLASH OF CLANS</span>
          <h2>Guerra ao vivo</h2>
          <p>Consulta da API a cada 30 segundos.</p>
        </div>

        <span className="badge">
          {stateLabels[war.state || ""] || war.state}
        </span>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        {syncControls}
      </div>

      <div className="grid-2">
        {sides.map(({ data, label }) => (
          <div className="card" key={data.tag}>
            <p className="muted">{label}</p>
            <h3>{data.name}</h3>
            <p>
              <strong>{data.stars}</strong> estrelas ·{" "}
              <strong>
                {Number(data.destructionPercentage).toFixed(1)}%
              </strong>{" "}
              destruição
            </p>
            <p>{data.attacks} ataques realizados</p>
          </div>
        ))}
      </div>

      <p>
        <strong>Tamanho:</strong> {war.teamSize} vs. {war.teamSize} ·{" "}
        <strong>Ataques por jogador:</strong>{" "}
        {war.attacksPerMember ?? "—"}
      </p>

      <p>
        <strong>Início:</strong> {formatDate(war.startTime)}
        <br />
        <strong>Término:</strong> {formatDate(war.endTime)}
      </p>

      <h3>Participantes do UPALELE</h3>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Posição</th>
              <th>Jogador</th>
              <th>CV</th>
              <th>Ataques recebidos</th>
            </tr>
          </thead>

          <tbody>
            {[...(war.clan.members || [])]
              .sort(
                (a, b) =>
                  (a.mapPosition ?? 999) -
                  (b.mapPosition ?? 999)
              )
              .map((member) => (
                <tr key={member.tag}>
                  <td>{member.mapPosition ?? "—"}</td>
                  <td>{member.name}</td>
                  <td>{member.townhallLevel ?? "—"}</td>
                  <td>{member.opponentAttacks ?? 0}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
