"use client";
import { useMemo, useState } from "react";
import sections from "./content.json";

type Section = { title: string; sourceHeading: string; content: string[] };
const content = sections as Section[];

export function LeadershipContent() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("Todas");
  const categories = ["Todas", ...content.map((section) => section.title)];
  const filtered = useMemo(() => content
    .filter((section) => active === "Todas" || section.title === active)
    .map((section) => ({
      ...section,
      lines: section.content.filter((line) => !query.trim() || `${section.title} ${line}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))),
    }))
    .filter((section) => !query.trim() || section.lines.length > 0 || section.title.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))),
  [query, active]);

  return <>
    <section className="banner">
      <span className="badge gold">👑 ACESSO RESTRITO</span>
      <h2>Memorial descritivo da liderança</h2>
      <p>Área reservada a líder e colíderes. Consulte a ideologia, os protocolos, as atribuições e os critérios de gestão do UPALELE.</p>
      <p className="muted">Conteúdo transcrito do documento original. A redação foi preservada; esta tela organiza a consulta, mas não substitui o documento oficial.</p>
    </section>
    <section className="card">
      <div className="section-head"><div><h2>Consultar o documento</h2><p>{content.length} seções do memorial da liderança</p></div><span className="badge">Privado</span></div>
      <input className="search" placeholder="Buscar palavra, regra ou atribuição..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="chips">{categories.map((category) => <button key={category} className={`chip ${active === category ? "active" : ""}`} onClick={() => setActive(category)}>{category}</button>)}</div>
      {filtered.length ? filtered.map((section) => <article className="rule" key={section.title}>
        <div className="rule-meta">UPALELE · LIDERANÇA</div>
        <h3>{section.title}</h3>
        {section.lines.map((line, index) => <p key={`${section.title}-${index}`} style={{ marginBottom: 8, whiteSpace: "pre-wrap" }}>{line}</p>)}
      </article>) : <p className="muted">Nenhum trecho encontrado para essa busca.</p>}
    </section>
  </>;
}
