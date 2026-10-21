
"use client";

import { useState, useTransition } from "react";
import {
  createRosterNote,
  updateRosterNote,
  deactivateRosterNote,
} from "@/app/membros/actions";

type NoteType =
  | "newcomer"
  | "multiple_accounts"
  | "temporary_inactivity"
  | "general";

type RosterNote = {
  id: string;
  member_name: string;
  note_type: string;
  details: string | null;
};

type Props = {
  notes: RosterNote[];
  playerNames: string[];
  canManage: boolean;
};

const noteLabels: Record<string, string> = {
  newcomer: "Novato para próxima guerra",
  multiple_accounts: "Múltiplas contas",
  temporary_inactivity: "Inatividade temporária",
  general: "Observação geral",
};

export function RosterNotesManager({
  notes,
  playerNames,
  canManage,
}: Props) {
  const [editing, setEditing] = useState<RosterNote | null>(null);
  const [memberName, setMemberName] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("general");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setEditing(null);
    setMemberName("");
    setNoteType("general");
    setDetails("");
    setMessage("");
  }

  function startEditing(note: RosterNote) {
    setEditing(note);
    setMemberName(note.member_name);
    setNoteType(note.note_type as NoteType);
    setDetails(note.details ?? "");
    setMessage("");
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!memberName.trim()) {
      setMessage("Selecione um jogador.");
      return;
    }

    startTransition(async () => {
      const input = { memberName, noteType, details };
      const result = editing
        ? await updateRosterNote({ ...input, id: editing.id })
        : await createRosterNote(input);

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      resetForm();
      setMessage(editing ? "Observação atualizada." : "Observação cadastrada.");
    });
  }

  function handleDeactivate(note: RosterNote) {
    if (
      !window.confirm(
        `Desativar a observação de ${note.member_name}? O registro será mantido no histórico.`
      )
    ) {
      return;
    }

    setMessage("");

    startTransition(async () => {
      const result = await deactivateRosterNote(note.id);

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      if (editing?.id === note.id) resetForm();
      setMessage("Observação desativada.");
    });
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="section-head">
        <div>
          <h2>Observações operacionais</h2>
          <p>Registros internos dos membros mantidos no Supabase.</p>
        </div>
        {canManage && <span className="badge">Gerenciar</span>}
      </div>

      {canManage && (
        <form onSubmit={handleSave} className="roster-note-form">
          <h3>{editing ? "Editar observação" : "Nova observação"}</h3>

          <label htmlFor="note-member">Jogador</label>
          <select
            id="note-member"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            required
          >
            <option value="">Selecione um jogador</option>
            {playerNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <label htmlFor="note-type">Categoria</label>
          <select
            id="note-type"
            value={noteType}
            onChange={(e) => setNoteType(e.target.value as NoteType)}
            required
          >
            <option value="newcomer">Novato para próxima guerra</option>
            <option value="multiple_accounts">Múltiplas contas</option>
            <option value="temporary_inactivity">Inatividade temporária</option>
            <option value="general">Observação geral</option>
          </select>

          <label htmlFor="note-details">Detalhes</label>
          <textarea
            id="note-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Descreva a observação..."
            rows={3}
            maxLength={1000}
          />

          <div className="roster-note-actions">
            <button type="submit" disabled={isPending}>
              {isPending
                ? "Salvando..."
                : editing
                  ? "Salvar alterações"
                  : "Cadastrar observação"}
            </button>

            {editing && (
              <button type="button" onClick={resetForm} disabled={isPending}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {message && <p className="muted" role="status">{message}</p>}

      {!notes.length ? (
        <p className="muted">Nenhuma observação operacional cadastrada.</p>
      ) : (
        <div className="list">
          {notes.map((note) => (
            <div className="item" key={note.id}>
              <div className="avatar">
                {note.member_name.slice(0, 2).toUpperCase()}
              </div>

              <div className="item-main">
                <b>{note.member_name}</b>
                <small>
                  {noteLabels[note.note_type] ?? note.note_type}
                  {note.details ? ` · ${note.details}` : ""}
                </small>
              </div>

              {canManage && (
                <div className="roster-note-actions">
                  <button
                    type="button"
                    onClick={() => startEditing(note)}
                    disabled={isPending}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeactivate(note)}
                    disabled={isPending}
                  >
                    Desativar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
