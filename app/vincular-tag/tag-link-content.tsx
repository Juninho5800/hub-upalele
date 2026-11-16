
"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

type RequestInfo = {
  status: string;
  created_at: string;
  rejection_reason: string | null;
} | null;

type Props = {
  playerName: string;
  hasLinkedTag: boolean;
  isActive: boolean;
  latestRequest: RequestInfo;
};

export function TagLinkContent({
  playerName,
  hasLinkedTag,
  isActive,
  latestRequest,
}: Props) {
  const [playerTag, setPlayerTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(
    latestRequest?.status === "pending"
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setMessage("");
    setSuccess(false);

    try {
      const response = await fetch("/api/tag-link/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerTag: playerTag.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Não foi possível enviar sua solicitação."
        );
      }

      setPending(true);
      setSuccess(true);
      setMessage(
        "TAG validada! Sua solicitação foi enviada para análise da liderança."
      );
      setPlayerTag("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro inesperado."
      );
    } finally {
      setBusy(false);
    }
  }

  const rejected = latestRequest?.status === "rejected";

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logo}>⚔</div>

        <div style={styles.eyebrow}>
          UPALELE · CLAN HUB
        </div>

        <h1 style={styles.title}>
          Vincule sua TAG
        </h1>

        <p style={styles.description}>
          Olá, {playerName}! Para acessar a central do clã, precisamos
          confirmar sua identidade dentro do Clash of Clans.
        </p>

        {hasLinkedTag && !isActive ? (
          <div style={styles.warning}>
            <strong>Perfil temporariamente inativo</strong>
            <p>
              Sua conta já possui uma TAG vinculada, mas está sem acesso
              ativo. Entre em contato com a liderança para verificar sua situação.
            </p>
          </div>
        ) : pending ? (
          <div style={styles.pendingBox}>
            <div style={styles.pendingIcon}>◷</div>

            <h2 style={styles.pendingTitle}>
              Solicitação em análise
            </h2>

            <p style={styles.description}>
              Sua TAG foi validada e enviada para a liderança. Assim que
              seu pedido for aprovado, seu acesso será liberado.
            </p>

            <span style={styles.pendingBadge}>
              AGUARDANDO APROVAÇÃO
            </span>
          </div>
        ) : (
          <>
            {rejected && (
              <div style={styles.warning}>
                <strong>Solicitação anterior rejeitada</strong>

                <p>
                  {latestRequest?.rejection_reason ||
                    "Você pode conferir sua TAG e enviar uma nova solicitação."}
                </p>
              </div>
            )}

            <form onSubmit={submit} style={styles.form}>
              <label htmlFor="playerTag" style={styles.label}>
                TAG DO JOGADOR
              </label>

              <input
                id="playerTag"
                type="text"
                value={playerTag}
                onChange={(event) => setPlayerTag(event.target.value)}
                placeholder="#XXXXXXXX"
                maxLength={16}
                required
                disabled={busy}
                style={styles.input}
              />

              <p style={styles.hint}>
                Informe a TAG do seu perfil no Clash of Clans.
                Você pode encontrá-la no seu perfil de jogador.
              </p>

              <button
                type="submit"
                disabled={busy || !playerTag.trim()}
                style={{
                  ...styles.submit,
                  ...(busy ? styles.disabled : {}),
                }}
              >
                {busy ? "VALIDANDO TAG..." : "VALIDAR E ENVIAR"}
                {!busy && <span>→</span>}
              </button>
            </form>
          </>
        )}

        {message && (
          <div
            role="alert"
            style={success ? styles.success : styles.error}
          >
            {message}
          </div>
        )}

        <div style={styles.notice}>
          <span>🔒</span>
          <p>
            A validação confirma se o jogador pertence ao clã UPALELE.
            A liberação do acesso depende da aprovação da liderança.
          </p>
        </div>

        <footer style={styles.footer}>
          UPALELE · ESTRATÉGIA · UNIÃO · VITÓRIA
        </footer>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    boxSizing: "border-box",
    background:
      "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,.17), transparent 45%), #080d18",
    color: "#f8fafc",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 490,
    padding: "38px 34px",
    boxSizing: "border-box",
    borderRadius: 22,
    border: "1px solid rgba(148,163,184,.17)",
    background: "linear-gradient(160deg, #152238, #0e1726)",
    boxShadow: "0 25px 80px rgba(0,0,0,.35)",
  },
  logo: {
    display: "grid",
    placeItems: "center",
    width: 52,
    height: 52,
    borderRadius: 15,
    background: "rgba(59,130,246,.16)",
    border: "1px solid rgba(96,165,250,.25)",
    color: "#93c5fd",
    fontSize: 25,
    marginBottom: 22,
  },
  eyebrow: {
    color: "#80b5ff",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 2,
  },
  title: {
    margin: "13px 0 10px",
    fontSize: 31,
    fontWeight: 900,
    letterSpacing: -1,
    color: "#fff",
  },
  description: {
    margin: 0,
    color: "#aebbd0",
    fontSize: 13,
    lineHeight: 1.8,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    marginTop: 30,
  },
  label: {
    marginBottom: 9,
    color: "#b7c4d8",
    fontSize: 10,
    fontWeight: 850,
    letterSpacing: 1.5,
  },
  input: {
    width: "100%",
    height: 52,
    boxSizing: "border-box",
    padding: "0 15px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,.23)",
    background: "rgba(4,10,20,.5)",
    color: "#fff",
    outline: "none",
    fontSize: 15,
  },
  hint: {
    margin: "9px 0 0",
    color: "#8294ae",
    fontSize: 11,
    lineHeight: 1.6,
  },
  submit: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
    width: "100%",
    minHeight: 51,
    marginTop: 23,
    border: "1px solid rgba(147,197,253,.4)",
    borderRadius: 10,
    background: "linear-gradient(100deg, #2563eb, #347fe8)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.2,
    cursor: "pointer",
  },
  disabled: {
    opacity: 0.65,
    cursor: "wait",
  },
  pendingBox: {
    marginTop: 30,
    padding: 22,
    textAlign: "center",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,.23)",
    background: "rgba(59,130,246,.08)",
  },
  pendingIcon: {
    color: "#93c5fd",
    fontSize: 35,
  },
  pendingTitle: {
    margin: "10px 0",
    fontSize: 19,
    color: "#fff",
  },
  pendingBadge: {
    display: "inline-block",
    marginTop: 18,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(245,158,11,.12)",
    color: "#fbbf24",
    border: "1px solid rgba(245,158,11,.2)",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1,
  },
  warning: {
    marginTop: 24,
    padding: 15,
    borderRadius: 11,
    border: "1px solid rgba(245,158,11,.25)",
    background: "rgba(245,158,11,.08)",
    color: "#fcd34d",
    fontSize: 12,
    lineHeight: 1.7,
  },
  success: {
    marginTop: 17,
    padding: 13,
    borderRadius: 10,
    background: "rgba(22,101,52,.15)",
    border: "1px solid rgba(74,222,128,.25)",
    color: "#bbf7d0",
    fontSize: 12,
    lineHeight: 1.6,
  },
  error: {
    marginTop: 17,
    padding: 13,
    borderRadius: 10,
    background: "rgba(127,29,29,.2)",
    border: "1px solid rgba(248,113,113,.25)",
    color: "#fecaca",
    fontSize: 12,
    lineHeight: 1.6,
  },
    notice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    marginTop: 27,
    padding: 14,
    borderRadius: 11,
    border: "1px solid rgba(148,163,184,.12)",
    background: "rgba(148,163,184,.045)",
  },

  footer: {
    marginTop: 27,
    paddingTop: 17,
    borderTop: "1px solid rgba(148,163,184,.12)",
    color: "#65758e",
    textAlign: "center",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1.2,
  },
};