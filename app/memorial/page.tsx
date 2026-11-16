"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/app-shell";

type Rule = {
  id: string;
  section: string;
  rule_number: string | null;
  title: string;
  body: string;
};

const sectionIcons: Record<string, string> = {
  Ideologia: "◆",
  "Guerra de clã": "⚔",
  "Estratégia de Guerra": "♟",
  "Liga de guerra": "🏆",
  Raide: "🛡",
  "Jogos do clã": "🎯",
  Push: "🚀",
  WhatsApp: "◉",
  Doações: "🎁",
  Anciões: "★",
};

export default function MemorialPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRules() {
      const supabase = createClient();

      try {
        // 1. Verificar autenticação
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          window.location.href = "/login";
          return;
        }

        // 2. Verificar se o perfil está aprovado e ativo
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_active, in_game_name, role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("[MEMORIAL] Erro ao consultar perfil:", profileError);

          if (active) {
            setErr("Não foi possível verificar sua autorização de acesso.");
            setLoading(false);
          }

          return;
        }

        // 3. Bloquear usuários sem aprovação
        if (!profile || profile.is_active !== true) {
          window.location.href = "/vincular-tag";
          return;
        }

        // 4. Buscar regras somente após validar o perfil
        const { data, error } = await supabase
          .from("memorial_rules")
          .select("id,section,rule_number,title,body")
          .eq("is_published", true)
          .order("sort_order", { ascending: true });

        if (!active) return;

        if (error) {
          setErr(error.message);
        } else {
          setRules((data || []) as Rule[]);
        }

        setLoading(false);
      } catch (error) {
        console.error("[MEMORIAL] Erro inesperado:", error);

        if (active) {
          setErr("Ocorreu um erro ao carregar o memorial.");
          setLoading(false);
        }
      }
    }

    loadRules();

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(rules.map((rule) => rule.section)))],
    [rules]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");

    return rules.filter((rule) => {
      const matchesCategory = cat === "Todas" || rule.section === cat;
      const searchable = `${rule.rule_number ?? ""} ${rule.section} ${rule.title} ${rule.body}`
        .toLocaleLowerCase("pt-BR");
      return matchesCategory && (!term || searchable.includes(term));
    });
  }, [rules, cat, query]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Rule[]>>((acc, rule) => {
      (acc[rule.section] ??= []).push(rule);
      return acc;
    }, {});
  }, [filtered]);

  const totalSections = new Set(rules.map((rule) => rule.section)).size;

  return (
    <AppShell title="Memorial" userName="UPALELE" role="membros">
      <main style={styles.page}>
        <section style={styles.hero}>
          <div style={styles.heroGlow} />
          <div style={styles.heroContent}>
            <div style={styles.eyebrow}>
              <span style={styles.eyebrowDot} />
              IDENTIDADE • REGRAS • COMPROMISSO
            </div>
            <h1 style={styles.heroTitle}>Memorial UPALELE</h1>
            <p style={styles.heroText}>
              Nossa história é construída em conjunto. Consulte os princípios,
              regras e responsabilidades que mantêm o clã unido e organizado.
            </p>
            <div style={styles.heroStats}>
              <div style={styles.heroStat}>
                <strong style={{ fontSize: 24, color: "#fff", lineHeight: 1 }}>{rules.length}</strong>
                <span>regras publicadas</span>
              </div>
              <div style={styles.statDivider} />
              <div style={styles.heroStat}>
                <strong style={{ fontSize: 24, color: "#fff", lineHeight: 1 }}>{totalSections}</strong>
                <span>categorias</span>
              </div>
            </div>
          </div>
          <div style={styles.heroMark} aria-hidden="true">
            U
          </div>
        </section>

        <section style={styles.contentCard}>
          <div style={styles.toolbarTop}>
            <div>
              <div style={styles.sectionKicker}>CONSULTA DO MEMORIAL</div>
              <h2 style={styles.sectionTitle}>Encontre uma regra</h2>
              <p style={styles.sectionDescription}>
                Pesquise por número, categoria ou palavra-chave.
              </p>
            </div>
            <div style={styles.countPill}>
              <span style={styles.countDot} />
              {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
            </div>
          </div>

          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>⌕</span>
            <input
              style={styles.searchInput}
              placeholder="Ex.: ataques, doações, guerra..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Buscar regras do memorial"
            />
            {query && (
              <button
                type="button"
                style={styles.clearButton}
                onClick={() => setQuery("")}
                aria-label="Limpar pesquisa"
              >
                ×
              </button>
            )}
          </div>

          <div style={styles.categoryLabel}>CATEGORIAS</div>
          <div style={styles.chips}>
            {categories.map((category) => {
              const active = cat === category;
              const count =
                category === "Todas"
                  ? rules.length
                  : rules.filter((rule) => rule.section === category).length;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCat(category)}
                  style={{
                    ...styles.chip,
                    ...(active ? styles.chipActive : {}),
                  }}
                >
                  <span>{category === "Todas" ? "☷" : sectionIcons[category] ?? "•"}</span>
                  {category}
                  <small style={{ ...styles.chipCount, ...(active ? styles.chipCountActive : {}) }}>
                    {count}
                  </small>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div style={styles.stateBox}>
              <div style={styles.loader} />
              <strong>Carregando o memorial...</strong>
              <span>Buscando as regras publicadas.</span>
            </div>
          ) : err ? (
            <div style={styles.errorBox}>
              <strong>Não foi possível carregar o memorial.</strong>
              <span>{err}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={styles.stateBox}>
              <div style={styles.emptyIcon}>⌕</div>
              <strong>Nenhuma regra encontrada</strong>
              <span>Tente outro termo ou selecione uma categoria diferente.</span>
              <button
                type="button"
                style={styles.resetButton}
                onClick={() => {
                  setQuery("");
                  setCat("Todas");
                }}
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div style={styles.results}>
              {Object.entries(grouped).map(([section, sectionRules], index) => (
                <section key={section} style={styles.ruleSection}>
                  <div style={styles.categoryHeading}>
                    <div style={styles.categoryIcon}>
                      {sectionIcons[section] ?? "•"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.categoryOverline}>CATEGORIA {String(index + 1).padStart(2, "0")}</div>
                      <h3 style={styles.categoryTitle}>{section}</h3>
                    </div>
                    <span style={styles.categoryTotal}>
                      {sectionRules.length} {sectionRules.length === 1 ? "regra" : "regras"}
                    </span>
                  </div>

                  <div style={styles.ruleList}>
                    {sectionRules.map((rule) => (
                      <article key={rule.id} style={styles.ruleCard}>
                        <div style={styles.ruleNumber}>
                          {rule.rule_number || "—"}
                        </div>
                        <div style={styles.ruleContent}>
                          <h4 style={styles.ruleTitle}>{rule.title}</h4>
                          <p style={styles.ruleBody}>{rule.body}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <footer style={styles.footer}>
          <span>UPALELE</span>
          <span>Respeito, estratégia e união.</span>
        </footer>
      </main>
    </AppShell>
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
    minHeight: 235,
    background: "linear-gradient(120deg, #151b2b 0%, #202d49 58%, #172033 100%)",
    border: "1px solid rgba(148,163,184,.18)",
    boxShadow: "0 18px 45px rgba(0,0,0,.16)",
  },
  heroGlow: {
    position: "absolute",
    width: 360,
    height: 360,
    right: 80,
    top: -220,
    borderRadius: "50%",
    background: "rgba(59,130,246,.20)",
    filter: "blur(12px)",
  },
  heroContent: { position: "relative", zIndex: 1, maxWidth: 700 },
  eyebrow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    color: "#a9c7ff",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "1.7px",
  },
  eyebrowDot: {
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
    maxWidth: 610,
    color: "#c3cddd",
    fontSize: 14,
    lineHeight: 1.75,
  },
  heroStats: { display: "flex", alignItems: "center", gap: 22, marginTop: 25 },
  heroStat: { display: "flex", flexDirection: "column", gap: 3 },
  heroStatStrong: {},
  statDivider: { width: 1, height: 32, background: "rgba(203,213,225,.25)" },
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
  contentCard: {
    borderRadius: 20,
    padding: "28px",
    background: "var(--card, #111827)",
    border: "1px solid var(--border, rgba(148,163,184,.18))",
    boxShadow: "0 12px 34px rgba(0,0,0,.08)",
  },
  toolbarTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 22,
    flexWrap: "wrap",
  },
  sectionKicker: {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "1.5px",
    marginBottom: 7,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 23,
    fontWeight: 800,
    letterSpacing: "-.5px",
    color: "var(--foreground, #f4f4f5)",
  },
  sectionDescription: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "var(--muted, #9ca3af)",
  },
  countPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(96,165,250,.24)",
    background: "rgba(59,130,246,.09)",
    color: "#93c5fd",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 11,
    fontWeight: 750,
  },
  countDot: { width: 7, height: 7, borderRadius: "50%", background: "#60a5fa" },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    border: "1px solid var(--border, rgba(148,163,184,.22))",
    background: "var(--background, rgba(2,6,23,.22))",
    borderRadius: 12,
    padding: "0 14px",
    minHeight: 49,
  },
  searchIcon: { fontSize: 25, color: "#94a3b8", lineHeight: 1 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: 0,
    outline: 0,
    background: "transparent",
    color: "var(--foreground, #f4f4f5)",
    fontSize: 13,
    height: 47,
  },
  clearButton: {
    border: 0,
    background: "transparent",
    color: "#94a3b8",
    fontSize: 22,
    cursor: "pointer",
  },
  categoryLabel: {
    margin: "23px 0 10px",
    color: "var(--muted, #9ca3af)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "1.3px",
  },
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 25 },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    border: "1px solid var(--border, rgba(148,163,184,.2))",
    background: "transparent",
    color: "var(--muted, #a1a1aa)",
    borderRadius: 999,
    padding: "8px 11px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  chipActive: {
    color: "#dbeafe",
    background: "rgba(37,99,235,.2)",
    borderColor: "rgba(96,165,250,.55)",
  },
  chipCount: {
    fontSize: 9,
    color: "#94a3b8",
    background: "rgba(148,163,184,.12)",
    borderRadius: 999,
    padding: "2px 6px",
  },
  chipCountActive: { color: "#bfdbfe", background: "rgba(96,165,250,.2)" },
  results: { display: "flex", flexDirection: "column", gap: 27 },
  ruleSection: { minWidth: 0 },
  categoryHeading: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    paddingBottom: 13,
    borderBottom: "1px solid var(--border, rgba(148,163,184,.15))",
    marginBottom: 12,
  },
  categoryIcon: {
    display: "grid",
    placeItems: "center",
    width: 40,
    height: 40,
    flex: "0 0 40px",
    borderRadius: 12,
    color: "#93c5fd",
    background: "rgba(59,130,246,.13)",
    fontSize: 17,
  },
  categoryOverline: {
    color: "#60a5fa",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "1.2px",
    marginBottom: 3,
  },
  categoryTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: "var(--foreground, #f4f4f5)",
  },
  categoryTotal: {
    color: "var(--muted, #9ca3af)",
    fontSize: 10,
    whiteSpace: "nowrap",
  },
  ruleList: { display: "flex", flexDirection: "column", gap: 8 },
  ruleCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "15px 16px",
    borderRadius: 13,
    border: "1px solid var(--border, rgba(148,163,184,.13))",
    background: "var(--background, rgba(2,6,23,.15))",
  },
  ruleNumber: {
    display: "grid",
    placeItems: "center",
    minWidth: 43,
    minHeight: 34,
    padding: "0 7px",
    borderRadius: 9,
    color: "#bfdbfe",
    background: "rgba(37,99,235,.17)",
    fontSize: 11,
    fontWeight: 850,
    fontVariantNumeric: "tabular-nums",
  },
  ruleContent: { flex: 1, minWidth: 0 },
  ruleTitle: {
    margin: "1px 0 5px",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 800,
    color: "var(--foreground, #f4f4f5)",
  },
  ruleBody: {
    margin: 0,
    color: "var(--muted, #a1a1aa)",
    fontSize: 12,
    lineHeight: 1.75,
    whiteSpace: "pre-wrap",
  },
  stateBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    textAlign: "center",
    padding: "52px 18px",
    color: "var(--muted, #9ca3af)",
    fontSize: 12,
  },
  loader: {
    width: 25,
    height: 25,
    borderRadius: "50%",
    border: "3px solid rgba(96,165,250,.2)",
    borderTopColor: "#60a5fa",
    marginBottom: 7,
    animation: "spin 1s linear infinite",
  },
  emptyIcon: { fontSize: 35, color: "#64748b", marginBottom: 4 },
  resetButton: {
    marginTop: 9,
    border: "1px solid rgba(96,165,250,.35)",
    borderRadius: 9,
    padding: "8px 13px",
    color: "#93c5fd",
    background: "rgba(59,130,246,.1)",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
  },
  errorBox: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    padding: 18,
    borderRadius: 12,
    color: "#fecaca",
    background: "rgba(127,29,29,.18)",
    border: "1px solid rgba(248,113,113,.25)",
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
