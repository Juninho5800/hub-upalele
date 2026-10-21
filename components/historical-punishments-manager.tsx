
"use client";

import { useState, useTransition } from "react";
import {
  createHistoricalRecord,
  deactivateHistoricalRecord,
  updateHistoricalRecord,
} from "@/app/historico/actions";

type HistoricalRecord = {
  id: string;
  source_order: number;
  member_name: string;
  date_text: string | null;
  notes: string | null;
  source_label: string;
};

export function HistoricalPunishmentsManager({
  rows,
  canManage,
}: {
  rows: HistoricalRecord[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<HistoricalRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [dateText, setDateText] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setEditing(null);
    setCreating(false);
    setMemberName("");
    setDateText("");
    setNotes("");
  }

  function startCreating() {
    resetForm();
    setCreating(true);
    setMessage("");
  }

  function startEditing(row: HistoricalRecord) {
    setCreating(false);
    setEditing(row);
    setMemberName(row.member_name);
    setDateText(row.date_text ?? "");
    setNotes(row.notes ?? "");
    setMessage("");
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const result = await createHistoricalRecord({
        memberName,
        dateText,
        notes,
      });

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      resetForm();
      setMessage("Punição adicionada ao histórico com sucesso.");
    });
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setMessage("");

    startTransition(async () => {
      const result = await updateHistoricalRecord({
        id: editing.id,
        memberName,
        dateText,
        notes,
      });

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      resetForm();
      setMessage("Registro atualizado com sucesso.");
    });
  }

  function handleDeactivate(row: HistoricalRecord) {
    const confirmed = window.confirm(
      `Deseja anular o registro de ${row.member_name}?\n\n` +
        "Ele será ocultado da lista padrão, mas continuará salvo no banco."
    );

    if (!confirmed) return;

    setMessage("");

    startTransition(async () => {
      const result = await deactivateHistoricalRecord(row.id);

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      if (editing?.id === row.id) resetForm();
      setMessage("Registro anulado e ocultado da listagem.");
    });
  }

  return (
    <div className="historical-manager">
      {canManage && !creating && !editing && (
        <div className="roster-note-actions">
          <button type="button" onClick={startCreating} disabled={isPending}>
            + Adicionar punição
          </button>
        </div>
      )}

      {canManage && creating && (
        <form
          className="roster-note-form historical-edit-form historical-create-form"
          onSubmit={handleCreate}
        >
          <h3>Adicionar punição ao histórico</h3>
          <p className="muted">
            Este cadastro será salvo apenas no histórico antigo. Não criará
            um gancho ativo.
          </p>

          <label htmlFor="new-history-member">Nick do jogador</label>
          <input
            id="new-history-member"
            value={memberName}
            onChange={(event) => setMemberName(event.target.value)}
            maxLength={100}
            required
          />

          <label htmlFor="new-history-date">Data original</label>
          <input
            id="new-history-date"
            value={dateText}
            onChange={(event) => setDateText(event.target.value)}
            maxLength={100}
            placeholder="Data da punição, se conhecida"
          />

          <label htmlFor="new-history-notes">Observação</label>
          <textarea
            id="new-history-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Motivo ou detalhes da punição..."
          />

          <div className="roster-note-actions">
            <button type="submit" disabled={isPending}>
              {isPending ? "Adicionando..." : "Adicionar ao histórico"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isPending}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {canManage && editing && (
        <form
          className="roster-note-form historical-edit-form"
          onSubmit={handleSave}
        >
          <h3>Editar registro histórico</h3>

          <label htmlFor="history-member">Nick do jogador</label>
          <input
            id="history-member"
            value={memberName}
            onChange={(event) => setMemberName(event.target.value)}
            maxLength={100}
            required
          />

          <label htmlFor="history-date">Data original</label>
          <input
            id="history-date"
            value={dateText}
            onChange={(event) => setDateText(event.target.value)}
            maxLength={100}
            placeholder="Data conforme o material original"
          />

          <label htmlFor="history-notes">Observação</label>
          <textarea
            id="history-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Observações do registro..."
          />

          <div className="roster-note-actions">
            <button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar alterações"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isPending}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {message && (
        <p className="muted historical-feedback" role="status">
          {message}
        </p>
      )}

      {!rows.length ? (
        <p className="muted">Nenhum registro histórico ativo.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nick</th>
                <th>Data original</th>
                <th>Observação</th>
                {canManage && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.source_order}</td>
                  <td><b>{row.member_name}</b></td>
                  <td>{row.date_text || "—"}</td>
                  <td>{row.notes || "Não informada"}</td>
                  {canManage && (
                    <td>
                      <div className="roster-note-actions">
                        <button
                          type="button"
                          onClick={() => startEditing(row)}
                          disabled={isPending || creating}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(row)}
                          disabled={isPending || creating}
                        >
                          Anular
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
    </div>
  );
}
