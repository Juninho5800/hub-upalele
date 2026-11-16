"use client";

import { useMemo, useState, type CSSProperties } from "react";
import sections from "./content.json";

type Section = { title: string; sourceHeading: string; content: string[] };
const content = sections as Section[];

const sectionIcons: Record<string, string> = {
  HISTÓRIA: "📜",
  IDEOLOGIA: "💡",
  "PROTOCOLO SEGURANÇA": "🛡️",
  COMUNICAÇÃO: "🗣️",
  "REVEZAMENTO LIDERANÇA": "🔄",
  LIDERANÇA: "👑",
  "DIVISÃO ATRIBUIÇÃO": "⚔️",
  "COLÍDER 1 (DEUS DA GUERRA)": "⚔️",
  "COLÍDER 2 (CHEFE DO OURO)": "🪙",
  "COLÍDER 3 (JOCKER DOS JOGOS)": "🏆",
  "COLÍDER 4 (REI EVENTUALISTA)": "🎉",
  "ALTERAÇÃO ATRIBUIÇÃO": "🔀",
  GANCHO: "🚷",
  CONCLUSÃO: "🦁",
};

function iconFor(title: string) {
  const normalized = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const match = Object.entries(sectionIcons).find(([key]) =>
    normalized.includes(key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase())
  );
  return match?.[1] ?? "📘";
}

export function LeadershipContent() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("Todas");
  const categories = useMemo(() => ["Todas", ...content.map((section) => section.title)], []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return content
      .filter((section) => active === "Todas" || section.title === active)
      .map((section) => ({
        ...section,
        lines: section.content.filter((line) =>
          !term || `${section.title} ${line}`.toLocaleLowerCase("pt-BR").includes(term)
        ),
      }))
      .filter((section) => !term || section.lines.length > 0 || section.title.toLocaleLowerCase("pt-BR").includes(term));
  }, [query, active]);

  const totalItems = content.reduce((total, section) => total + section.content.length, 0);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroGlow} />
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}><span style={styles.eyebrowDot} /> ACESSO RESTRITO · LIDERANÇA UPALELE</div>
          <h1 style={styles.heroTitle}>Memorial da Liderança</h1>
          <p style={styles.heroText}>
            Os princípios, protocolos e responsabilidades que orientam a gestão do clã.
            Um registro para preservar nossa história e manter a liderança alinhada.
          </p>
          <div style={styles.heroStats}>
            <div style={styles.heroStat}><strong>{content.length}</strong><span>capítulos</span></div>
            <div style={styles.statDivider} />
            <div style={styles.heroStat}><strong>{totalItems}</strong><span>registros</span></div>
            <div style={styles.statDivider} />
            <div style={styles.heroStat}><strong>👑</strong><span>uso interno</span></div>
          </div>
        </div>
        <div style={styles.heroMark} aria-hidden="true">U</div>
      </section>

      <section style={styles.contentCard}>
        <div style={styles.toolbarTop}>
          <div>
            <div style={styles.sectionKicker}>DOCUMENTO OFICIAL · CONSULTA</div>
            <h2 style={styles.sectionTitle}>Consulte as diretrizes</h2>
            <p style={styles.sectionDescription}>Pesquise por assunto ou selecione um capítulo para navegar pelo memorial.</p>
          </div>
          <div style={styles.countPill}><span style={styles.countDot} />{filtered.length} {filtered.length === 1 ? "capítulo" : "capítulos"}</div>
        </div>

        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>⌕</span>
          <input
            style={styles.searchInput}
            placeholder="Buscar história, regra, protocolo ou atribuição..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar no memorial da liderança"
          />
          {query && <button type="button" style={styles.clearButton} onClick={() => setQuery("")} aria-label="Limpar pesquisa">×</button>}
        </div>

        <div style={styles.categoryLabel}>CAPÍTULOS DO MEMORIAL</div>
        <div style={styles.chips}>
          {categories.map((category) => {
            const selected = active === category;
            const count = category === "Todas" ? content.length : content.find((section) => section.title === category)?.content.length ?? 0;
            return (
              <button key={category} type="button" onClick={() => setActive(category)} style={{ ...styles.chip, ...(selected ? styles.chipActive : {}) }}>
                <span>{category === "Todas" ? "✦" : iconFor(category)}</span>
                {category}
                <small style={{ ...styles.chipCount, ...(selected ? styles.chipCountActive : {}) }}>{count}</small>
              </button>
            );
          })}
        </div>

        {filtered.length ? (
          <div style={styles.results}>
            {filtered.map((section, index) => (
              <article key={section.title} style={styles.ruleSection}>
                <div style={styles.categoryHeading}>
                  <div style={styles.categoryIcon}>{iconFor(section.title)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.categoryOverline}>CAPÍTULO {String(content.findIndex((item) => item.title === section.title) + 1).padStart(2, "0")}</div>
                    <h3 style={styles.categoryTitle}>{section.title}</h3>
                    {section.sourceHeading && <p style={styles.sourceHeading}>{section.sourceHeading}</p>}
                  </div>
                  <span style={styles.categoryTotal}>{section.lines.length} {section.lines.length === 1 ? "item" : "itens"}</span>
                </div>
                <div style={styles.ruleList}>
                  {section.lines.map((line, lineIndex) => (
                    <div key={`${section.title}-${lineIndex}`} style={styles.ruleCard}>
                      <span style={styles.ruleMarker}>{String(lineIndex + 1).padStart(2, "0")}</span>
                      <p style={styles.ruleBody}>{line}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <span style={{ fontSize: 30 }}>⌕</span>
            <strong>Nenhum trecho encontrado</strong>
            <span>Tente outro termo ou selecione um capítulo diferente.</span>
            <button type="button" style={styles.resetButton} onClick={() => { setQuery(""); setActive("Todas"); }}>Limpar filtros</button>
          </div>
        )}
      </section>

      <footer style={styles.footer}><strong>UPALELE</strong><span>Democracia · Responsabilidade · União</span></footer>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { width: "100%", maxWidth: 1180, margin: "0 auto", padding: "8px 0 34px", color: "var(--foreground, #f4f4f5)" },
  hero: { position: "relative", overflow: "hidden", borderRadius: 22, padding: "34px 38px", marginBottom: 22, minHeight: 235, background: "linear-gradient(120deg, #151b2b 0%, #202d49 58%, #172033 100%)", border: "1px solid rgba(148,163,184,.18)", boxShadow: "0 18px 45px rgba(0,0,0,.16)" },
  heroGlow: { position: "absolute", width: 360, height: 360, right: 80, top: -220, borderRadius: "50%", background: "rgba(59,130,246,.20)", filter: "blur(12px)" },
  heroContent: { position: "relative", zIndex: 1, maxWidth: 720 },
  eyebrow: { display: "flex", alignItems: "center", gap: 9, color: "#a9c7ff", fontSize: 10, fontWeight: 800, letterSpacing: "1.7px" },
  eyebrowDot: { width: 7, height: 7, borderRadius: "50%", background: "#60a5fa", boxShadow: "0 0 12px #60a5fa" },
  heroTitle: { margin: "13px 0 9px", fontSize: "clamp(29px, 4vw, 43px)", lineHeight: 1.08, letterSpacing: "-1.5px", fontWeight: 850, color: "#fff" },
  heroText: { margin: 0, maxWidth: 650, color: "#c3cddd", fontSize: 14, lineHeight: 1.75 },
  heroStats: { display: "flex", alignItems: "center", gap: 22, marginTop: 25, flexWrap: "wrap" },
  heroStat: { display: "flex", flexDirection: "column", gap: 3 },
  statDivider: { width: 1, height: 32, background: "rgba(203,213,225,.25)" },
  heroMark: { position: "absolute", right: 52, bottom: -55, color: "rgba(255,255,255,.055)", fontSize: 270, lineHeight: 1, fontWeight: 900, userSelect: "none" },
  contentCard: { borderRadius: 20, padding: "28px", background: "var(--card, #111827)", border: "1px solid var(--border, rgba(148,163,184,.18))", boxShadow: "0 12px 34px rgba(0,0,0,.08)" },
  toolbarTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" },
  sectionKicker: { color: "#60a5fa", fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", marginBottom: 7 },
  sectionTitle: { margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-.5px", color: "var(--foreground, #f4f4f5)" },
  sectionDescription: { margin: "6px 0 0", fontSize: 13, color: "var(--muted, #9ca3af)" },
  countPill: { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(96,165,250,.24)", background: "rgba(59,130,246,.09)", color: "#93c5fd", borderRadius: 999, padding: "8px 12px", fontSize: 11, fontWeight: 750 },
  countDot: { width: 7, height: 7, borderRadius: "50%", background: "#60a5fa" },
  searchWrap: { display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--border, rgba(148,163,184,.22))", background: "var(--background, rgba(2,6,23,.22))", borderRadius: 12, padding: "0 14px", minHeight: 49 },
  searchIcon: { fontSize: 25, color: "#94a3b8", lineHeight: 1 },
  searchInput: { flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: "var(--foreground, #f4f4f5)", fontSize: 13, height: 47 },
  clearButton: { border: 0, background: "transparent", color: "#94a3b8", fontSize: 22, cursor: "pointer" },
  categoryLabel: { margin: "23px 0 10px", color: "var(--muted, #9ca3af)", fontSize: 10, fontWeight: 800, letterSpacing: "1.3px" },
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 25 },
  chip: { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--border, rgba(148,163,184,.2))", background: "transparent", color: "var(--muted, #a1a1aa)", borderRadius: 999, padding: "8px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  chipActive: { color: "#dbeafe", background: "rgba(37,99,235,.2)", borderColor: "rgba(96,165,250,.55)" },
  chipCount: { fontSize: 9, color: "#94a3b8", background: "rgba(148,163,184,.12)", borderRadius: 999, padding: "2px 6px" },
  chipCountActive: { color: "#bfdbfe", background: "rgba(96,165,250,.2)" },
  results: { display: "flex", flexDirection: "column", gap: 27 },
  ruleSection: { minWidth: 0 },
  categoryHeading: { display: "flex", alignItems: "center", gap: 12, paddingBottom: 13, borderBottom: "1px solid var(--border, rgba(148,163,184,.15))", marginBottom: 12 },
  categoryIcon: { display: "grid", placeItems: "center", width: 42, height: 42, flex: "0 0 42px", borderRadius: 13, color: "#93c5fd", background: "rgba(59,130,246,.13)", fontSize: 19 },
  categoryOverline: { color: "#60a5fa", fontSize: 9, fontWeight: 800, letterSpacing: "1.2px", marginBottom: 3 },
  categoryTitle: { margin: 0, fontSize: 16, fontWeight: 800, color: "var(--foreground, #f4f4f5)" },
  sourceHeading: { margin: "4px 0 0", color: "var(--muted, #9ca3af)", fontSize: 11 },
  categoryTotal: { color: "var(--muted, #9ca3af)", fontSize: 10, whiteSpace: "nowrap" },
  ruleList: { display: "flex", flexDirection: "column", gap: 8 },
  ruleCard: { display: "flex", alignItems: "flex-start", gap: 13, padding: "14px 15px", borderRadius: 13, border: "1px solid var(--border, rgba(148,163,184,.13))", background: "var(--background, rgba(2,6,23,.15))" },
  ruleMarker: { display: "grid", placeItems: "center", minWidth: 31, height: 28, borderRadius: 8, color: "#bfdbfe", background: "rgba(37,99,235,.17)", fontSize: 9, fontWeight: 850, fontVariantNumeric: "tabular-nums" },
  ruleBody: { flex: 1, minWidth: 0, margin: 0, color: "var(--muted, #c0c4ce)", fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", padding: "52px 18px", color: "var(--muted, #9ca3af)", fontSize: 12 },
  resetButton: { marginTop: 9, border: "1px solid rgba(96,165,250,.35)", borderRadius: 9, padding: "8px 13px", color: "#93c5fd", background: "rgba(59,130,246,.1)", cursor: "pointer", fontSize: 11, fontWeight: 700 },
  footer: { display: "flex", justifyContent: "space-between", gap: 12, padding: "18px 5px 0", color: "var(--muted, #71717a)", fontSize: 10, letterSpacing: ".3px" },
};
