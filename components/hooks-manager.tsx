
"use client";

import { useState } from "react";
import { cancelHook, updateHook } from "@/app/ganchos/actions";

type HookRecord = {
  id: string;
  member_name: string;
  punishment_label: string;
  duration_wars: number | null;
  reason: string | null;
  return_date: string | null;
  source_note: string | null;
  status: string;
  created_at: string;
};

type Props = {
  rows: HookRecord[];
  canManage: boolean;
};

export function HooksManager({ rows, canManage }: Props) {
  const [editing, setEditing] = useState<HookRecord | null>(null);
  const [memberName, setMemberName] = useState("");
  const [punishmentLabel, setPunishmentLabel] = useState("");
  const [durationWars, setDurationWars] = useState("");
  const [reason, setReason] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  function startEditing(hook: HookRecord) {
    setEditing(hook);
    setMemberName(hook.member_name);
    setPunishmentLabel(hook.punishment_label);
    setDurationWars(
      hook.duration_wars === null ? "" : String(hook.duration_wars)
    );
    setReason(hook.reason ?? "");
    setReturnDate(hook.return_date ?? "");
    setSourceNote(hook.source_note ?? "");
    setFeedback("");
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy) return;

    setBusy(true);
    setFeedback("");

    const result = await updateHook({
      id: editing.id,
      member_name: memberName,
      punishment_label: punishmentLabel,
      duration_wars: durationWars.trim() === "" ? null : Number(durationWars),
      reason,
      return_date: returnDate,
      source_note: sourceNote,
    });

    setBusy(false);

    if (!result.success) {
      setFeedback(result.error);
      return;
    }

    setEditing(null);
    setFeedback("Gancho atualizado com sucesso.");
    window.location.reload();
  }

  async function deactivate(hook: HookRecord) {
    if (busy) return;

    const confirmed = window.confirm(
      `Deseja cancelar o gancho de ${hook.member_name}?\n\nO registro será preservado no banco, mas sairá da lista de ganchos ativos.`
    );

    if (!confirmed) return;

    setBusy(true);
    setFeedback("");

    const result = await cancelHook(hook.id);

    setBusy(false);

    if (!result.success) {
      setFeedback(result.error);
      return;
    }

    setFeedback("Gancho cancelado. O registro foi preservado.");
    window.location.reload();
  }

  return (
    <>

      {feedback && (
        <p className="historical-feedback" role="status">
          {feedback}
        </p>
      )}

      {editing && (
        <form className="roster-note-form historical-edit-form" onSubmit={saveEdit}>
          <h3>Editar gancho</h3>

          <label className="field-label">Membro</label>
          <input
            className="field"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            maxLength={200}
            required
          />

          <label className="field-label">Punição</label>
          <input
            className="field"
            value={punishmentLabel}
            onChange={(e) => setPunishmentLabel(e.target.value)}
            maxLength={200}
            required
          />

          <label className="field-label">Duração (guerras)</label>
          <input
            className="field"
            type="number"
            min="0"
            max="10000"
            step="1"
            value={durationWars}
            onChange={(e) => setDurationWars(e.target.value)}
          />

          <label className="field-label">Motivo</label>
          <textarea
            className="field"
            rows={3}
            maxLength={5000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <label className="field-label">Data de retorno</label>
          <input
            className="field"
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />

          <label className="field-label">Nota de origem</label>
          <textarea
            className="field"
            rows={3}
            maxLength={5000}
            value={sourceNote}
            onChange={(e) => setSourceNote(e.target.value)}
          />

          <div className="roster-note-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Salvando..." : "Salvar alterações"}
            </button>

            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setFeedback("");
              }}
            >
              Cancelar edição
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="muted">
          Sem ganchos ativos. Os registros concluídos ou cancelados não aparecem
          nesta listagem.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Membro(s)</th>
                <th>Punição</th>
                <th>Motivo</th>
                <th>Retorno</th>
                <th>Nota de origem</th>
                {canManage && <th>Ações</th>}
              </tr>
            </thead>

            <tbody>
              {rows.map((hook) => (
                <tr key={hook.id}>
                  <td>
                    <b>{hook.member_name}</b>
                  </td>
                  <td>
                    {hook.punishment_label}
                    {hook.duration_wars
                      ? ` (${hook.duration_wars} guerras)`
                      : ""}
                  </td>
                  <td>{hook.reason || "Não informado"}</td>
                  <td>{hook.return_date || "Conferir nota"}</td>
                  <td>{hook.source_note || "—"}</td>


                  {canManage && (
                    <td>
                      <div className="roster-note-actions">
                        <button
                          className="btn"
                          type="button"
                          disabled={busy}
                          onClick={() => startEditing(hook)}
                        >
                          Editar
                        </button>

                        <button
                          className="btn"
                          type="button"
                          disabled={busy}
                          onClick={() => deactivate(hook)}
                        >
                          Desativar
                        </button>
                      </div>
                    </td>
                  )}


                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
