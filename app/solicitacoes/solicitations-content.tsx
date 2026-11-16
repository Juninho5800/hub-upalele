
"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

type RequestItem = {
  id: string;
  player_tag: string;
  in_game_name: string;
  status: string;
  created_at: string;
};

type Props = {
  requests: RequestItem[];
};

export function SolicitationsContent({ requests: initialRequests }: Props) {
  const router = useRouter();

  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  async function handleAction(
    id: string,
    action: "approve" | "reject"
  ) {
    setBusyId(id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/tag-link/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          action === "approve"
            ? { requestId: id }
            : { requestId: id, reason: reason.trim() || null }
        ),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível concluir a operação.");
      }

      setRequests((current) => current.filter((item) => item.id !== id));
      setRejectId(null);
      setReason("");

      setMessage(
        action === "approve"
          ? "Jogador aprovado com sucesso!"
          : "Solicitação rejeitada com sucesso!"
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro inesperado."
      );
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.glow} />

        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>
            <span style={styles.dot} />
            ACESSO RESTRITO · GESTÃO DO CLÃ
          </div>

          <h1 style={styles.heroTitle}>
            Solicitações de acesso
          </h1>

          <p style={styles.heroText}>
            Gerencie os pedidos de vinculação de TAG dos jogadores
            que desejam acessar o Clan Hub UPALELE.
          </p>

          <div style={styles.stats}>
            <div style={styles.stat}>
              <strong>{requests.length}</strong>
              <span>pendentes</span>
            </div>

            <div style={styles.divider} />

            <div style={styles.stat}>
              <strong>👑</strong>
              <span>liderança</span>
            </div>
          </div>
        </div>

        <div style={styles.heroMark} aria-hidden="true">
          U
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.kicker}>
              CENTRAL ADMINISTRATIVA
            </div>

            <h2 style={styles.title}>
              Pedidos de vinculação
            </h2>

            <p style={styles.description}>
              Confira os dados e decida se deseja aprovar ou rejeitar cada jogador.
            </p>
          </div>

          <span style={styles.count}>
            {requests.length} {requests.length === 1 ? "pedido" : "pedidos"}
          </span>
        </div>

        {message && (
          <div style={styles.successMessage}>
            {message}
          </div>
        )}

        {error && (
          <div style={styles.errorMessage}>
            {error}
          </div>
        )}

        {requests.length === 0 ? (
          <div style={styles.empty}>
            <span style={{ fontSize: 34 }}>✓</span>
            <strong>Nenhuma solicitação pendente</strong>
            <span>
              Quando um jogador solicitar acesso, o pedido aparecerá aqui.
            </span>
          </div>
        ) : (
          <div style={styles.list}>
            {requests.map((item) => (
              <article key={item.id} style={styles.requestCard}>
                <div style={styles.requestHeader}>
                  <div style={styles.playerIcon}>⚔️</div>

                  <div style={styles.playerInfo}>
                    <h3 style={styles.playerName}>
                      {item.in_game_name}
                    </h3>

                    <span style={styles.tag}>
                      {item.player_tag}
                    </span>
                  </div>

                  <span style={styles.pending}>
                    PENDENTE
                  </span>
                </div>

                <div style={styles.date}>
                  Solicitado em {formatDate(item.created_at)}
                </div>

                {rejectId === item.id && (
                  <div style={styles.rejectArea}>
                    <label style={styles.label}>
                      Motivo da rejeição (opcional)
                    </label>

                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={500}
                      placeholder="Informe o motivo da rejeição..."
                      style={styles.textarea}
                    />

                    <div style={styles.rejectActions}>
                      <button
                        type="button"
                        style={styles.cancelButton}
                        onClick={() => {
                          setRejectId(null);
                          setReason("");
                        }}
                        disabled={busyId === item.id}
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        style={styles.rejectButton}
                        onClick={() => handleAction(item.id, "reject")}
                        disabled={busyId === item.id}
                      >
                        {busyId === item.id ? "Processando..." : "Confirmar rejeição"}
                      </button>
                    </div>
                  </div>
                )}

                {rejectId !== item.id && (
                  <div style={styles.actions}>
                    <button
                      type="button"
                      style={styles.approveButton}
                      onClick={() => handleAction(item.id, "approve")}
                      disabled={busyId === item.id}
                    >
                      {busyId === item.id ? "Processando..." : "✓ Aprovar"}
                    </button>

                    <button
                      type="button"
                      style={styles.rejectButton}
                      onClick={() => {
                        setRejectId(item.id);
                        setReason("");
                        setError("");
                      }}
                      disabled={busyId === item.id}
                    >
                      ✕ Rejeitar
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <footer style={styles.footer}>
        <strong>UPALELE</strong>
        <span>Democracia · Responsabilidade · União</span>
      </footer>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "8px 0 34px",
    color: "var(--foreground, #f4f4f5)",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    padding: "34px 38px",
    marginBottom: 22,
    minHeight: 220,
    background: "linear-gradient(120deg, #151b2b 0%, #202d49 58%, #172033 100%)",
    border: "1px solid rgba(148,163,184,.18)",
    boxShadow: "0 18px 45px rgba(0,0,0,.16)",
  },
  glow: {
    position: "absolute",
    width: 360,
    height: 360,
    right: 80,
    top: -220,
    borderRadius: "50%",
    background: "rgba(59,130,246,.20)",
    filter: "blur(12px)",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    maxWidth: 720,
  },
  eyebrow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    color: "#a9c7ff",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "1.7px",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#60a5fa",
    boxShadow: "0 0 12px #60a5fa",
  },
  heroTitle: {
    margin: "13px 0 9px",
    fontSize: "clamp(29px, 4vw, 43px)",
    lineHeight: 1.08,
    letterSpacing: "-1.5px",
    fontWeight: 850,
    color: "#fff",
  },
  heroText: {
    margin: 0,
    maxWidth: 650,
    color: "#c3cddd",
    fontSize: 14,
    lineHeight: 1.75,
  },
  stats: {
    display: "flex",
    alignItems: "center",
    gap: 22,
    marginTop: 25,
    flexWrap: "wrap",
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  divider: {
    width: 1,
    height: 32,
    background: "rgba(203,213,225,.25)",
  },
  heroMark: {
    position: "absolute",
    right: 52,
    bottom: -55,
    color: "rgba(255,255,255,.055)",
    fontSize: 270,
    lineHeight: 1,
    fontWeight: 900,
    userSelect: "none",
  },
  card: {
    borderRadius: 20,
    padding: 28,
    background: "var(--card, #111827)",
    border: "1px solid var(--border, rgba(148,163,184,.18))",
    boxShadow: "0 12px 34px rgba(0,0,0,.08)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 22,
    flexWrap: "wrap",
  },
  kicker: {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "1.5px",
    marginBottom: 7,
  },
  title: {
    margin: 0,
    fontSize: 23,
    fontWeight: 800,
    color: "var(--foreground, #f4f4f5)",
  },
  description: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "var(--muted, #9ca3af)",
  },
  count: {
    border: "1px solid rgba(96,165,250,.24)",
    background: "rgba(59,130,246,.09)",
    color: "#93c5fd",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 11,
    fontWeight: 750,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  requestCard: {
    padding: 18,
    borderRadius: 14,
    border: "1px solid var(--border, rgba(148,163,184,.15))",
    background: "var(--background, rgba(2,6,23,.15))",
  },
  requestHeader: {
    display: "flex",
    alignItems: "center",
    gap: 13,
  },
  playerIcon: {
    display: "grid",
    placeItems: "center",
    width: 44,
    height: 44,
    flex: "0 0 44px",
    borderRadius: 13,
    background: "rgba(59,130,246,.13)",
    fontSize: 20,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 800,
    color: "var(--foreground, #f4f4f5)",
  },
  tag: {
    display: "block",
    marginTop: 4,
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 700,
  },
  pending: {
    color: "#fbbf24",
    background: "rgba(245,158,11,.10)",
    border: "1px solid rgba(245,158,11,.22)",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: ".8px",
  },
  date: {
    marginTop: 13,
    color: "var(--muted, #9ca3af)",
    fontSize: 11,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 17,
  },
  approveButton: {
    border: "1px solid rgba(34,197,94,.35)",
    borderRadius: 9,
    padding: "9px 15px",
    color: "#86efac",
    background: "rgba(34,197,94,.12)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 750,
  },
  rejectButton: {
    border: "1px solid rgba(248,113,113,.3)",
    borderRadius: 9,
    padding: "9px 15px",
    color: "#fca5a5",
    background: "rgba(239,68,68,.10)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 750,
  },
  rejectArea: {
    marginTop: 17,
    paddingTop: 16,
    borderTop: "1px solid var(--border, rgba(148,163,184,.15))",
  },
  label: {
    display: "block",
    marginBottom: 8,
    color: "var(--muted, #c0c4ce)",
    fontSize: 12,
    fontWeight: 700,
  },
  textarea: {
    display: "block",
    width: "100%",
    minHeight: 85,
    resize: "vertical",
    boxSizing: "border-box",
    border: "1px solid var(--border, rgba(148,163,184,.22))",
    borderRadius: 10,
    padding: 12,
    outline: "none",
    background: "var(--background, #0b1120)",
    color: "var(--foreground, #f4f4f5)",
    font: "inherit",
    fontSize: 12,
  },
  rejectActions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 9,
    marginTop: 12,
  },
  cancelButton: {
    border: "1px solid var(--border, rgba(148,163,184,.22))",
    borderRadius: 9,
    padding: "9px 15px",
    color: "var(--muted, #c0c4ce)",
    background: "transparent",
    cursor: "pointer",
    fontSize: 12,
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 9,
    textAlign: "center",
    padding: "55px 18px",
    color: "var(--muted, #9ca3af)",
    fontSize: 12,
  },
  successMessage: {
    marginBottom: 15,
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,.25)",
    background: "rgba(34,197,94,.08)",
    color: "#86efac",
    fontSize: 12,
  },
  errorMessage: {
    marginBottom: 15,
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,.25)",
    background: "rgba(239,68,68,.08)",
    color: "#fca5a5",
    fontSize: 12,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "18px 5px 0",
    color: "var(--muted, #71717a)",
    fontSize: 10,
    letterSpacing: ".3px",
  },
};
