
"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";

type RecommendationResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  player?: {
    name: string;
    position: number;
    townHallLevel: number;
    attacksUsed: number;
  };
  attackType?: string;
  recommendation?: {
    tag: string;
    name: string;
    position: number;
    townHallLevel: number;
  } | null;
  reason?: string;
  warning?: string;
};

export default function AttackAssistant() {
  const [type, setType] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] =
    useState<RecommendationResponse | null>(null);

  async function recommend() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        `/api/clash/recommend-target?type=${type}`,
        { cache: "no-store" }
      );

      const data =
        (await response.json()) as RecommendationResponse;

      if (!response.ok) {
        throw new Error(
          data.error || "Não foi possível consultar a guerra."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro inesperado."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      title="Assistente de ataques"
      userName="UPALELE"
      role="membros"
    >
      <div className="grid content-grid">
        <section className="card">
          <h2>Qual ataque você vai fazer?</h2>

          <p className="muted">
            Consulte o mapa atual da guerra e receba uma
            recomendação baseada nas regras do memorial.
          </p>

          <label className="field-label" htmlFor="attack-type">
            Tipo de ataque
          </label>

          <select
            id="attack-type"
            className="field"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setResult(null);
              setError("");
            }}
          >
            <option value="1">
              1º ataque — posição e estrelas
            </option>
            <option value="2">
              2º ataque — CV e estrelas
            </option>
          </select>

          <button
            className="btn primary"
            style={{ marginTop: 14 }}
            onClick={recommend}
            disabled={loading}
          >
            {loading
              ? "Consultando guerra..."
              : "Recomendar alvo →"}
          </button>

          {error && (
            <div className="result">
              <h3>Não foi possível consultar</h3>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="result">
              <h3>Recomendação de ataque</h3>

              {result.player && (
                <p>
                  <strong>Jogador:</strong>{" "}
                  {result.player.name} — posição #
                  {result.player.position}, CV{" "}
                  {result.player.townHallLevel}
                </p>
              )}

              {result.recommendation ? (
                <>
                  <p>
                    <strong>Alvo recomendado:</strong>{" "}
                    {result.recommendation.name}
                  </p>
                  <p>
                    <strong>Posição inimiga:</strong> #
                    {result.recommendation.position}
                  </p>
                  <p>
                    <strong>Centro de Vila:</strong> CV{" "}
                    {result.recommendation.townHallLevel}
                  </p>
                  <p>
                    <strong>Tag:</strong>{" "}
                    {result.recommendation.tag}
                  </p>
                  {result.reason && <p>{result.reason}</p>}
                </>
              ) : (
                <p>
                  {result.message ||
                    "Nenhum alvo recomendado neste momento."}
                </p>
              )}

              {result.warning && (
                <p>
                  <strong>Atenção:</strong> {result.warning}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Guia visual do UPALELE</h2>

          <p className="muted">
            Consulte o guia e confirme a situação do alvo
            no mapa antes de atacar.
          </p>

          <img
            className="guide"
            src="/assets/guia-ataques.png"
            alt="Guia de primeiro e segundo ataque"
          />

          <p className="muted">
            A recomendação considera os dados disponibilizados
            pela API. A situação de um ataque em andamento deve
            ser conferida manualmente.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
