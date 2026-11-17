
"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [showPassword, setShowPassword] = useState(false);
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [otp, setOtp] = useState("");

  function changeMode(newMode: "login" | "signup") {
    setMode(newMode);
    setMessage("");
    setPassword("");
    setOtp("");
    setAwaitingOtp(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setMessage("");

    try {
      const supabase = createClient();

      if (awaitingOtp) {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otp.trim(),
          type: "signup",
        });

        if (error) throw error;

        window.location.href = "/vincular-tag";
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (data.session) {
          window.location.href = "/vincular-tag";
          return;
        }

        setAwaitingOtp(true);
        setMessageType("success");
        setMessage(
          "Enviamos um código de confirmação para seu e-mail. Digite os oito dígitos para ativar sua conta."
        );
        setPassword("");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("player_tag, is_active")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile || !profile.player_tag || !profile.is_active) {
        window.location.href = "/vincular-tag";
        return;
      }

      window.location.href = "/dashboard";
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a operação."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.ambientOne} aria-hidden="true" />
      <div style={styles.ambientTwo} aria-hidden="true" />

      <section style={styles.loginLayout}>
        <aside style={styles.brandPanel}>
          <img
            src="/assets/upalele-banner.png"
            alt=""
            aria-hidden="true"
            style={styles.brandBackgroundImage}
          />
          <div style={styles.brandImageOverlay} aria-hidden="true" />

          <div style={styles.brandTop}>
            <div style={styles.logoFrame}>
              <img
                src="/assets/upalele-banner.png"
                alt="Identidade visual UPALELE"
                style={styles.logo}
              />
            </div>

            <div>
              <div style={styles.brandName}>UPALELE</div>
              <div style={styles.brandSubtitle}>CLAN HUB</div>
            </div>
          </div>

          <div style={styles.brandMessage}>
            <div style={styles.eyebrow}>
              <span style={styles.eyebrowLine} />
              CENTRAL DO CLÃ
            </div>

            <h1 style={styles.heroTitle}>
              Estratégia.
              <br />
              União.
              <br />
              <span style={styles.heroAccent}>Legado.</span>
            </h1>

            <p style={styles.heroText}>
              Um espaço para organizar nossa jornada, acompanhar resultados
              e fortalecer tudo o que construímos juntos.
            </p>
          </div>

          <div style={styles.brandFooter}>
            <span style={styles.clanTag}>#PLV2VQQP</span>
            <span style={styles.footerDivider} />
            <span>DESDE 2014</span>
          </div>

          <div style={styles.watermark} aria-hidden="true">
            U
          </div>
        </aside>

        <div style={styles.formPanel}>
          <div style={styles.mobileBrand}>
            <img
              src="/assets/upalele-banner.png"
              alt="UPALELE"
              style={styles.mobileLogo}
            />
            <span>
              UPALELE <small>CLAN HUB</small>
            </span>
          </div>

          <div style={styles.formContent}>
            <div style={styles.accessPill}>
              <span style={styles.statusDot} />
              AMBIENTE RESTRITO
            </div>

            <h2 style={styles.formTitle}>
              {awaitingOtp ? "Confirme seu e-mail" : mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
            </h2>

            <p style={styles.formDescription}>
              {awaitingOtp
                ? `Digite o código de oito dígitos enviado para ${email.trim()}.`
                : mode === "login"
                  ? "Entre com suas credenciais para acessar a central do UPALELE."
                  : "Crie seu acesso para solicitar vinculação ao clã UPALELE."}
            </p>

            {awaitingOtp && (
              <p style={styles.spamHint}>
                Não recebeu o código? Verifique também as pastas de Spam, Lixo
                eletrônico e Promoções. Nosso e-mail de confirmação pode acabar
                sendo direcionado para uma dessas pastas.
              </p>
            )}

            {!awaitingOtp && <div style={styles.modeSwitch}>
              <button
                type="button"
                onClick={() => changeMode("login")}
                style={
                  mode === "login"
                    ? styles.modeActive
                    : styles.modeButton
                }
              >
                ENTRAR
              </button>

              <button
                type="button"
                onClick={() => changeMode("signup")}
                style={
                  mode === "signup"
                    ? styles.modeActive
                    : styles.modeButton
                }
              >
                CRIAR CONTA
              </button>
            </div>}

            <form onSubmit={submit} style={styles.form}>
              <label htmlFor="email" style={styles.label}>
                E-MAIL
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seuemail@exemplo.com"
                style={styles.input}
              />

              {awaitingOtp ? (
                <>
                  <label htmlFor="otp" style={styles.label}>
                    CÓDIGO DE CONFIRMAÇÃO
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    required
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                    placeholder="Digite os 8 dígitos"
                    style={{ ...styles.input, ...styles.otpInput }}
                  />
                </>
              ) : (
                <>
              <div style={styles.passwordHeading}>
                <label htmlFor="password" style={styles.label}>
                  SENHA
                </label>
              </div>

              <div style={styles.passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={6}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  style={{ ...styles.input, ...styles.passwordInput }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  style={styles.showPassword}
                  aria-label={
                    showPassword ? "Ocultar senha" : "Mostrar senha"
                  }
                >
                  {showPassword ? "OCULTAR" : "MOSTRAR"}
                </button>
              </div>
                </>
              )}

              <button
                type="submit"
                disabled={busy}
                style={{
                  ...styles.submit,
                  ...(busy ? styles.submitBusy : {}),
                }}
              >
                {busy
                  ? "PROCESSANDO..."
                  : awaitingOtp
                    ? "CONFIRMAR CÓDIGO"
                    : mode === "login"
                      ? "ACESSAR A CENTRAL"
                      : "CRIAR MINHA CONTA"}

                {!busy && !awaitingOtp && <span style={styles.submitArrow}>→</span>}
              </button>

              {message && (
                <div
                  role="alert"
                  aria-live="polite"
                  style={
                    messageType === "success"
                      ? styles.successBox
                      : styles.errorBox
                  }
                >
                  {message}
                </div>
              )}
            </form>

            <div style={styles.notice}>
              <span style={styles.lockIcon}>⌑</span>

              <p style={styles.noticeText}>
                {awaitingOtp
                  ? "Após confirmar seu e-mail, você será direcionado para vincular sua TAG do Clash of Clans."
                  : mode === "login"
                    ? "O acesso à central depende da aprovação da liderança e da vinculação de uma TAG válida do clã."
                    : "Após criar sua conta, você deverá informar sua TAG do Clash of Clans e aguardar a aprovação da liderança."}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "grid",
    placeItems: "center",
    position: "relative",
    overflow: "hidden",
    padding: "32px 20px",
    boxSizing: "border-box",
    color: "#f8fafc",
    background:
      "radial-gradient(ellipse at 15% 10%, rgba(37,99,235,.18), transparent 38%), radial-gradient(ellipse at 90% 90%, rgba(14,116,144,.12), transparent 35%), #080d18",
    fontFamily: "Arial, Helvetica, sans-serif",
  },

  ambientOne: {
    position: "absolute",
    width: 420,
    height: 420,
    border: "1px solid rgba(148,163,184,.07)",
    borderRadius: "50%",
    top: -250,
    left: -170,
    pointerEvents: "none",
  },

  ambientTwo: {
    position: "absolute",
    width: 560,
    height: 560,
    border: "1px solid rgba(148,163,184,.06)",
    borderRadius: "50%",
    bottom: -380,
    right: -230,
    pointerEvents: "none",
  },

  loginLayout: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 1060,
    minHeight: 650,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    overflow: "hidden",
    borderRadius: 26,
    border: "1px solid rgba(148,163,184,.16)",
    background: "#101827",
    boxShadow: "0 30px 100px rgba(0,0,0,.42)",
  },

  brandPanel: {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "42px 44px",
    background:
      "linear-gradient(145deg, #17243a 0%, #111c30 55%, #0d1727 100%)",
    borderRight: "1px solid rgba(148,163,184,.12)",
  },

  brandBackgroundImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    opacity: 0.32,
    pointerEvents: "none",
  },

  brandImageOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(13,23,39,.48), rgba(13,23,39,.82))",
    pointerEvents: "none",
  },

  brandTop: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    position: "relative",
    zIndex: 1,
  },

  logoFrame: {
    width: 62,
    height: 62,
    display: "grid",
    placeItems: "center",
    borderRadius: 17,
    background: "rgba(255,255,255,.07)",
    border: "1px solid rgba(226,232,240,.17)",
    padding: 0,
    overflow: "hidden",
    boxSizing: "border-box",
  },

  logo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
  },

  brandName: {
    fontSize: 19,
    fontWeight: 900,
    letterSpacing: 2.8,
    color: "#fff",
  },

  brandSubtitle: {
    marginTop: 4,
    color: "#91a9ca",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 3.2,
  },

  brandMessage: {
    position: "relative",
    zIndex: 1,
    maxWidth: 390,
    margin: "65px 0",
  },

  eyebrow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#9db9e8",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 2.2,
  },

  eyebrowLine: {
    width: 25,
    height: 2,
    background: "#60a5fa",
    borderRadius: 2,
  },

  heroTitle: {
    margin: "22px 0 18px",
    fontSize: "clamp(42px, 5vw, 62px)",
    lineHeight: 1.02,
    letterSpacing: -2.5,
    fontWeight: 900,
    color: "#fff",
  },

  heroAccent: {
    color: "#80b5ff",
  },

  heroText: {
    maxWidth: 340,
    margin: 0,
    color: "#aebbd0",
    fontSize: 14,
    lineHeight: 1.85,
  },

  brandFooter: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: 13,
    color: "#8294ae",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1.5,
  },

  clanTag: {
    color: "#b9c9e2",
  },

  footerDivider: {
    width: 1,
    height: 13,
    background: "rgba(148,163,184,.35)",
  },

  watermark: {
    position: "absolute",
    right: -35,
    bottom: 25,
    fontSize: 330,
    lineHeight: 1,
    fontWeight: 900,
    color: "rgba(255,255,255,.025)",
    userSelect: "none",
  },

  formPanel: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "58px 58px 28px",
    background: "linear-gradient(160deg, #121c2d, #0e1726)",
  },

  mobileBrand: {
    display: "none",
  },

  formContent: {
    width: "100%",
    maxWidth: 370,
    margin: "auto",
  },

  accessPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid rgba(96,165,250,.2)",
    background: "rgba(59,130,246,.09)",
    color: "#9dc5ff",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1.4,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#60a5fa",
    boxShadow: "0 0 10px #60a5fa",
  },

  formTitle: {
    margin: "23px 0 8px",
    color: "#fff",
    fontSize: 30,
    fontWeight: 850,
    letterSpacing: -1,
  },

  formDescription: {
    margin: 0,
    color: "#91a0b7",
    fontSize: 13,
    lineHeight: 1.7,
  },

  spamHint: {
    margin: "12px 0 0",
    padding: "11px 13px",
    borderRadius: 10,
    border: "1px solid rgba(96,165,250,.18)",
    background: "rgba(59,130,246,.07)",
    color: "#aebed5",
    fontSize: 11,
    lineHeight: 1.6,
  },

  modeSwitch: {
    display: "flex",
    gap: 8,
    padding: 4,
    marginTop: 22,
    borderRadius: 11,
    background: "rgba(4,10,20,.42)",
    border: "1px solid rgba(148,163,184,.15)",
  },

  modeButton: {
    flex: 1,
    minHeight: 38,
    border: 0,
    borderRadius: 8,
    background: "transparent",
    color: "#8999b0",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  modeActive: {
    flex: 1,
    minHeight: 38,
    border: "1px solid rgba(96,165,250,.3)",
    borderRadius: 8,
    background: "rgba(37,99,235,.2)",
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    marginTop: 28,
  },

  label: {
    display: "block",
    marginBottom: 9,
    color: "#b7c4d8",
    fontSize: 9,
    fontWeight: 850,
    letterSpacing: 1.5,
  },

  input: {
    width: "100%",
    height: 51,
    boxSizing: "border-box",
    padding: "0 15px",
    borderRadius: 11,
    border: "1px solid rgba(148,163,184,.2)",
    outline: "none",
    background: "rgba(4,10,20,.42)",
    color: "#f8fafc",
    fontSize: 13,
    marginBottom: 22,
  },

  passwordHeading: {
    display: "flex",
    justifyContent: "space-between",
  },

  otpInput: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 8,
  },

  passwordWrap: {
    position: "relative",
  },

  passwordInput: {
    paddingRight: 82,
    marginBottom: 0,
  },

  showPassword: {
    position: "absolute",
    right: 12,
    top: 0,
    height: 51,
    border: 0,
    background: "transparent",
    color: "#8fb8ed",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.8,
    cursor: "pointer",
  },

  submit: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 15,
    width: "100%",
    minHeight: 52,
    marginTop: 24,
    padding: "0 18px",
    border: "1px solid rgba(147,197,253,.4)",
    borderRadius: 11,
    background: "linear-gradient(100deg, #2563eb, #347fe8)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.3,
    cursor: "pointer",
    boxShadow: "0 10px 25px rgba(37,99,235,.2)",
  },

  submitBusy: {
    opacity: 0.7,
    cursor: "wait",
  },

  submitArrow: {
    fontSize: 18,
    lineHeight: 1,
    fontWeight: 400,
  },

  errorBox: {
    marginTop: 15,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,.25)",
    background: "rgba(127,29,29,.2)",
    color: "#fecaca",
    fontSize: 12,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },

  successBox: {
    marginTop: 15,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid rgba(74,222,128,.25)",
    background: "rgba(22,101,52,.15)",
    color: "#bbf7d0",
    fontSize: 12,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },

  notice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    marginTop: 27,
    padding: "14px 15px",
    borderRadius: 11,
    border: "1px solid rgba(148,163,184,.12)",
    background: "rgba(148,163,184,.045)",
  },

  lockIcon: {
    color: "#8fb8ed",
    fontSize: 18,
    lineHeight: 1,
  },

  noticeText: {
    margin: 0,
    color: "#8999b0",
    fontSize: 10,
    lineHeight: 1.6,
  },

  formFooter: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  color: "#8294ae",
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: 1.1,
},
};
