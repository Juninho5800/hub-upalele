"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type VoteOption = { id: string; vote_id: string; label: string; sort_order: number };
type Ballot = { id: string; vote_id: string; option_id: string; voter_id: string; created_at: string };
type Vote = { id: string; title: string; description: string; category: string; punishment_member_name: string | null; punishment_label: string | null; punishment_duration_wars: number | null; punishment_reason: string | null; punishment_approval_option_id: string | null; status: "open" | "closed" | "cancelled"; created_by: string; deadline: string; tie_break_option_id: string | null; decided_at: string | null; created_at: string };
type Profile = { id: string; in_game_name: string; role: string };
type FullVote = Vote & { options: VoteOption[]; ballots: Ballot[] };

export function VotingContent({ userId, role }: { userId: string; role: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [votes, setVotes] = useState<FullVote[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Punição");
  const [hours, setHours] = useState("24");
  const [optionsText, setOptionsText] = useState("Advertência\nGancho de 1 guerra\nGancho de 2 guerras\nGancho de 3 guerras\nGancho de 5 guerras\nGancho de 7 dias\nGancho de 14 dias\nGancho de 30 dias\nKick definitivo\nOutra punição");
  const [filter, setFilter] = useState("Todas");
  const [punishedMember, setPunishedMember] = useState("");
  const [punishmentLabel, setPunishmentLabel] = useState("Gancho");
  const [punishmentWars, setPunishmentWars] = useState("1");
  const [punishmentReason, setPunishmentReason] = useState("");
  const [punishmentDays, setPunishmentDays] = useState("7");
  const [customPunishment, setCustomPunishment] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [v, o, b, p] = await Promise.all([
      supabase.from("leadership_votes").select("*").order("created_at", { ascending: false }),
      supabase.from("leadership_vote_options").select("*").order("sort_order"),
      supabase.from("leadership_vote_ballots").select("*"),
      supabase.from("profiles").select("id,in_game_name,role").eq("is_active", true),
    ]);
    const firstError = v.error || o.error || b.error || p.error;
    if (firstError) { setError(firstError.message.includes("does not exist") || firstError.message.includes("schema cache") ? "A tabela de votações ainda não existe no Supabase. Execute o script 0004_sistema_votacoes.sql." : firstError.message); setLoading(false); return; }
    const opts = (o.data || []) as VoteOption[];
    const ballots = (b.data || []) as Ballot[];
    setProfiles((p.data || []) as Profile[]);
    setVotes(((v.data || []) as Vote[])
      .filter((vote) => vote.category === "Punição")
      .map((vote) => ({
        ...vote,
        options: opts.filter((x) => x.vote_id === vote.id),
        ballots: ballots.filter((x) => x.vote_id === vote.id),
      })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { void load(); }, [load]);

  async function createVote(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    if (category !== "Punição") { setError("Esta página aceita somente votações de punição."); setBusy(false); return; }
    const rawOptionLabels = optionsText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    const hasCustomPunishmentOption =
      category === "Punição" &&
      rawOptionLabels.some((x) => x.toLocaleLowerCase("pt-BR") === "outra punição");

    if (hasCustomPunishmentOption && !customPunishment.trim()) {
      setError("Preencha o campo Punição personalizada ou remova a opção 'Outra punição'.");
      setBusy(false);
      return;
    }

    const optionLabels = rawOptionLabels
      .map((x) =>
        category === "Punição" &&
        x.toLocaleLowerCase("pt-BR") === "outra punição"
          ? customPunishment.trim()
          : x
      )
      .filter(Boolean);

    if (optionLabels.length < 2) {
      setError("Adicione pelo menos duas opções, uma por linha.");
      setBusy(false);
      return;
    }
    if (new Set(optionLabels.map((x) => x.toLocaleLowerCase("pt-BR"))).size !== optionLabels.length) { setError("Existem opções repetidas. Ajuste antes de criar."); setBusy(false); return; }
    if (category === "Punição" && (!punishedMember.trim() || !punishmentReason.trim())) { setError("Para votação de punição, informe o membro e o motivo."); setBusy(false); return; }
    const deadline = new Date(Date.now() + Math.max(1, Number(hours) || 24) * 60 * 60 * 1000).toISOString();
    const { data: vote, error: voteError } = await supabase.from("leadership_votes").insert({ title: title.trim(), description: description.trim(), category, deadline, created_by: userId, punishment_member_name: category === "Punição" ? punishedMember.trim() : null, punishment_label: category === "Punição" ? punishmentLabel.trim() : null, punishment_duration_wars: category === "Punição" && punishmentWars ? Number(punishmentWars) : null, punishment_reason: category === "Punição" ? punishmentReason.trim() : null }).select("id").single();
    if (voteError || !vote) { setError(voteError?.message || "Não foi possível criar a votação."); setBusy(false); return; }
    const { error: optionError } = await supabase.from("leadership_vote_options").insert(optionLabels.map((label, index) => ({ vote_id: vote.id, label, sort_order: index })));
    if (optionError) { setError(`A votação foi criada, mas houve erro ao salvar as opções: ${optionError.message}`); setBusy(false); await load(); return; }
    setTitle(""); setDescription(""); setCategory("Punição"); setHours("24"); setOptionsText("Advertência\nGancho de 1 guerra\nGancho de 2 guerras\nGancho de 3 guerras\nGancho de 5 guerras\nGancho de 7 dias\nGancho de 14 dias\nGancho de 30 dias\nKick definitivo\nOutra punição"); setPunishedMember(""); setPunishmentLabel("Gancho"); setPunishmentWars("1"); setPunishmentReason(""); setPunishmentDays("7"); setCustomPunishment(""); setShowCreate(false); setNotice("Votação criada. A liderança já pode registrar os votos."); setBusy(false); await load();
  }

  async function castVote(voteId: string, optionId: string) {
    setBusy(true); setError(""); setNotice("");
    const { error: insertError } = await supabase.from("leadership_vote_ballots").insert({ vote_id: voteId, option_id: optionId, voter_id: userId });
    if (insertError) setError(insertError.code === "23505" ? "Você já votou nesta votação. Cada pessoa pode registrar apenas um voto." : insertError.message);
    else setNotice("Voto registrado.");
    setBusy(false); await load();
  }

  async function closeVote(vote: FullVote) {
    setBusy(true); setError(""); setNotice("");
    const max = maxVotes(vote);
    const winners = vote.options.filter(o => count(vote, o.id) === max && max > 0);
    const chosenId = vote.tie_break_option_id || (winners.length === 1 ? winners[0].id : null);
    if (vote.category === "Punição" && !chosenId) { setError("A votação de punição está empatada ou sem votos. Registre o desempate do líder antes de encerrar."); setBusy(false); return; }
    const { error: updateError } = await supabase.from("leadership_votes").update({ status: "closed", decided_at: new Date().toISOString() }).eq("id", vote.id).eq("status", "open");
    if (updateError) { setError(updateError.message); setBusy(false); return; }
    if (vote.category === "Punição" && chosenId) {
      const winningOption = vote.options.find(o => o.id === chosenId);
      const winningLabel = winningOption?.label || vote.punishment_label || "Punição definida pela liderança";
      const warsMatch = winningLabel.match(/(\d+)\s*(?:guerra|guerras)\b/i);
      const daysMatch = winningLabel.match(/(\d+)\s*dias?\b/i);
      const durationWars = warsMatch ? Number(warsMatch[1]) : null;
      const appliedOn = new Date();
      const returnDate = daysMatch ? new Date(appliedOn.getTime() + Number(daysMatch[1]) * 24 * 60 * 60 * 1000) : null;
      const { data: existing } = await supabase.from("punishments").select("id").eq("source_vote_id", vote.id).maybeSingle();
      if (!existing) {
        const isKick = /kick|expuls[aã]o definitiva/i.test(winningLabel);
        const { data: punishment, error: punishmentError } = await supabase.from("punishments").insert({ member_name: vote.punishment_member_name, applied_on: appliedOn.toISOString().slice(0, 10), punishment_label: winningLabel, duration_wars: durationWars, return_date: returnDate ? returnDate.toISOString().slice(0, 10) : null, reason: vote.punishment_reason, status: isKick ? "served" : "active", source_note: `${isKick ? "Decisão de kick registrada" : "Decisão aprovada"} pela votação ${vote.id}; revisar execução no clã.`, source_vote_id: vote.id, created_by: userId }).select("id").single();
        if (punishmentError) { setError(`Votação encerrada, mas a punição não foi criada automaticamente: ${punishmentError.message}. Não encerre novamente; a liderança deve regularizar este registro.`); setBusy(false); await load(); return; }
        if (punishment) await supabase.from("punishment_audit").insert({ punishment_id: punishment.id, action: "created", new_data: { source_vote_id: vote.id, member_name: vote.punishment_member_name, punishment_label: winningLabel, duration_wars: durationWars, return_date: returnDate ? returnDate.toISOString().slice(0, 10) : null, reason: vote.punishment_reason }, note: "Punição vencedora registrada automaticamente após votação da liderança.", changed_by: userId });
        setNotice(/kick|expuls[aã]o definitiva/i.test(winningLabel) ? "Votação encerrada. A decisão de kick foi registrada no histórico; a remoção do jogador do jogo precisa ser executada pela liderança no Clash of Clans." : "Votação encerrada e punição vencedora registrada nos ganchos ativos.");
      } else setNotice("Votação encerrada. A punição vinculada já existia; nenhum duplicado foi criado.");
    } else setNotice("Votação encerrada.");
    setBusy(false); await load();
  }

  async function tieBreak(vote: FullVote, optionId: string) {
    if (role !== "leader") return;
    setBusy(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("leadership_votes").update({ tie_break_option_id: optionId }).eq("id", vote.id).eq("status", "open");
    if (updateError) setError(updateError.message); else setNotice("Desempate registrado. Confira o resultado e encerre a votação para aplicar a decisão.");
    setBusy(false); await load();
  }

  const visibleVotes = votes.filter((v) => filter === "Todas" || (filter === "Abertas" ? v.status === "open" && new Date(v.deadline) > new Date() : v.status !== "open" || new Date(v.deadline) <= new Date()));
  const profileName = (id: string) => profiles.find((p) => p.id === id)?.in_game_name || "Membro da liderança";
  const count = (vote: FullVote, optionId: string) => vote.ballots.filter((b) => b.option_id === optionId).length;
  const maxVotes = (vote: FullVote) => Math.max(0, ...vote.options.map((o) => count(vote, o.id)));
  const leadersCount = profiles.filter((p) => ["leader", "co_leader"].includes(p.role)).length;

  return <>
    <section className="banner"><span className="badge gold">👑 ACESSO RESTRITO</span><h2>Votações da liderança</h2><p>Crie votações de punição, registre um voto por pessoa e acompanhe o resultado. O prazo padrão é de 24 horas.</p><p className="muted">Somente perfis ativos de líder e colíder podem consultar e votar. O voto de desempate é exclusivo do líder.</p></section>
    <section className="grid stats">filter
      <div className="card"><div className="stat-label">Votações abertas</div><div className="stat-number">{votes.filter(v => v.status === "open" && new Date(v.deadline) > new Date()).length}</div></div>
      <div className="card"><div className="stat-label">Votações encerradas</div><div className="stat-number">{votes.filter(v => v.status !== "open" || new Date(v.deadline) <= new Date()).length}</div></div>
      <div className="card"><div className="stat-label">Liderança ativa</div><div className="stat-number">{leadersCount}</div></div>
      <div className="card"><div className="stat-label">Meu voto pendente</div><div className="stat-number">{votes.filter(v => v.status === "open" && new Date(v.deadline) > new Date() && !v.ballots.some(b => b.voter_id === userId)).length}</div></div>
    </section>
    <section className="card">
      <div className="section-head"><div><h2>Votações de punição</h2><p>Uma pessoa, um voto por votação.</p></div><button className="btn primary" onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancelar" : "+ Nova votação"}</button></div>
      {showCreate && <form className="card" style={{ marginBottom: 16 }} onSubmit={createVote}>
        <label className="field-label">Título da decisão</label><input className="field" required minLength={3} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Aplicação de gancho ao membro..." />
        <label className="field-label">Contexto / justificativa</label><textarea className="field" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva os fatos para a liderança avaliar." />
        <div className="grid two"><div><label className="field-label">Categoria</label><input className="field" value="Punição" readOnly /></div><div><label className="field-label">Prazo em horas</label><input className="field" type="number" min="1" max="168" value={hours} onChange={e => setHours(e.target.value)} required /></div></div>
        {category === "Punição" && <div className="card" style={{ margin: "12px 0" }}><h3>Dados da punição (serão vinculados à votação)</h3><label className="field-label">Nick do membro punido</label><input className="field" required value={punishedMember} onChange={e => setPunishedMember(e.target.value)} placeholder="Nick exatamente como aparece no clã"/><label className="field-label">Motivo</label><textarea className="field" rows={2} required value={punishmentReason} onChange={e => setPunishmentReason(e.target.value)} placeholder="Regra do memorial e descrição do ocorrido"/><label className="field-label">Punição personalizada</label><input className="field" value={customPunishment} onChange={e => setCustomPunishment(e.target.value)} placeholder="Ex.: gancho de 10 guerras"/><p className="muted">Se mantiver a opção “Outra punição” na lista abaixo, preencha este campo. O texto informado substituirá “Outra punição” e será apresentado como uma opção real para votação. As demais opções continuam disponíveis. Em empate, somente o líder escolhe entre as opções empatadas. O kick fica registrado para execução manual no Clash of Clans.</p></div>}
        <label className="field-label">Opções de voto (uma por linha; mínimo 2)</label><textarea className="field" rows={4} value={optionsText} onChange={e => setOptionsText(e.target.value)} required />
        <p className="muted">O prazo padrão é 24 horas. O memorial determina que votações de punição deem 24 horas para participação.</p>
        <button className="btn primary" disabled={busy} type="submit">{busy ? "Salvando..." : "Criar votação"}</button>
      </form>}
      <div className="chips">{["Todas", "Abertas", "Encerradas"].map(x => <button key={x} className={`chip ${filter === x ? "active" : ""}`} onClick={() => setFilter(x)}>{x}</button>)}</div>
      {error && <p className="error">{error}</p>}{notice && <p className="success">{notice}</p>}
      {loading ? <p className="muted">Carregando votações...</p> : visibleVotes.length === 0 ? <p className="muted">Nenhuma votação de punição encontrada. Crie a primeira para registrar uma decisão da liderança.</p> : <div className="list">{visibleVotes.map(vote => {
        const expired = new Date(vote.deadline) <= new Date(); const open = vote.status === "open" && !expired; const myBallot = vote.ballots.find(b => b.voter_id === userId); const max = maxVotes(vote); const leaders = profiles.filter(p => ["leader", "co_leader"].includes(p.role)); const allVoted = leaders.length > 0 && leaders.every(p => vote.ballots.some(b => b.voter_id === p.id)); const tied = vote.options.filter(o => count(vote, o.id) === max && max > 0).length > 1;
        return <article className="item" key={vote.id} style={{ display: "block", padding: 16 }}>
          <div className="section-head"><div><span className="badge">{vote.category}</span> <span className={`badge ${open ? "green" : ""}`}>{open ? "Aberta" : vote.status === "cancelled" ? "Cancelada" : "Encerrada"}</span><h3 style={{ margin: "9px 0 4px" }}>{vote.title}</h3></div><div className="muted" style={{ textAlign: "right" }}>{vote.ballots.length} voto(s)<br/>{open ? `Prazo: ${new Date(vote.deadline).toLocaleString("pt-BR")}` : `Criada: ${new Date(vote.created_at).toLocaleDateString("pt-BR")}`}</div></div>
          {vote.description && <p style={{ whiteSpace: "pre-wrap", color: "#c2bdcf", fontSize: 13 }}>{vote.description}</p>}
          <div className="list">{vote.options.map(option => { const n = count(vote, option.id); const percent = vote.ballots.length ? Math.round(n / vote.ballots.length * 100) : 0; const isLeaderTieBreak = vote.tie_break_option_id === option.id; return <div key={option.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><b style={{ fontSize: 13 }}>{option.label}{isLeaderTieBreak ? " · desempate do líder" : ""}</b><span className="muted">{n} ({percent}%)</span></div>
            <div style={{ height: 6, background: "#15131e", borderRadius: 9, margin: "7px 0", overflow: "hidden" }}><div style={{ width: `${percent}%`, height: "100%", background: "var(--gold)" }} /></div>
            {open && !myBallot && <button className="btn" disabled={busy} onClick={() => void castVote(vote.id, option.id)}>Votar nesta opção</button>}
            {myBallot?.option_id === option.id && <span className="badge green">Seu voto</span>}
          </div>; })}</div>
          <div className="muted" style={{ marginTop: 10 }}>Criada por {profileName(vote.created_by)} · {vote.ballots.length} de {leaders.length} votos da liderança</div>
          {myBallot && open && <p className="success">Seu voto já foi registrado e não pode ser alterado.</p>}
          {open && (role === "leader" || vote.created_by === userId) && <div className="inline-form" style={{ marginTop: 12 }}>
            {role === "leader" && tied && <><span className="muted" style={{ alignSelf: "center" }}>Empate: líder decide</span>{vote.options.filter(o => count(vote, o.id) === max).map(o => <button key={o.id} className="btn" disabled={busy} onClick={() => void tieBreak(vote, o.id)}>Desempatar: {o.label}</button>)}</>}
            {(role === "leader" || allVoted || expired) && <button className="btn" disabled={busy} onClick={() => void closeVote(vote)}>Encerrar votação</button>}
          </div>}
        </article>;
      })}</div>}
    </section>
  </>;
}
