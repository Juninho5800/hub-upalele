
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createHistoricalRecord,
  deactivateHistoricalRecord,
  updateHistoricalRecord,
  updateAutomaticPunishment,
  deactivateAutomaticPunishment,
} from "@/app/historico/actions";

type HistoricalRecord = {
  id: string;
  source_order: number | null;
  member_name: string;
  date_text: string | null;
  notes: string | null;
  source_label: string;
  origin: "historical" | "automatic";
  return_date: string | null;
  punishment_label: string | null;
};

type RecordType = "Kick / Expulsão" | "Outro motivo";

export function HistoricalPunishmentsManager({
  rows,
  canManage,
}: {
  rows: HistoricalRecord[];
  canManage: boolean;
}) {
  const router = useRouter();

  const [editing, setEditing] = useState<HistoricalRecord | null>(null);
  const [creating, setCreating] = useState(false);

  const [memberName, setMemberName] = useState("");
  const [dateText, setDateText] = useState("");
  const [notes, setNotes] = useState("");
  const [recordType, setRecordType] =
    useState<RecordType>("Kick / Expulsão");

  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setEditing(null);
    setCreating(false);
    setMemberName("");
    setDateText("");
    setNotes("");
    setRecordType("Kick / Expulsão");
  }

  function startCreating() {
    resetForm();
    setCreating(true);
    setMessage("");
  }

  function startEditing(row: HistoricalRecord) {
    setEditing(row);
    setCreating(false);
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
        recordType,
      });

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      resetForm();
      setMessage("Novo registro criado com sucesso.");
      router.refresh();
    });
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editing) return;

    setMessage("");

    startTransition(async () => {
      const result =
        editing.origin === "automatic"
          ? await updateAutomaticPunishment({
              id: editing.id,
              memberName,
              dateText,
              notes,
            })
          : await updateHistoricalRecord({
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
      router.refresh();
    });
  }

  function handleDeactivate(row: HistoricalRecord) {
    const confirmed = window.confirm(
      `Deseja anular o registro de ${row.member_name}?\n\n` +
        "Ele será ocultado do histórico, mas continuará salvo no banco de dados."
    );

    if (!confirmed) return;

    setMessage("");

    startTransition(async () => {
      const result =
        row.origin === "automatic"
          ? await deactivateAutomaticPunishment(row.id)
          : await deactivateHistoricalRecord(row.id);

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      if (editing?.id === row.id) {
        resetForm();
      }

      setMessage("Registro anulado e ocultado da listagem.");
      router.refresh();
    });
  }

  function formatDate(value: string | null) {
    if (!value) return "—";

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }

    return value;
  }

  return (
    <div className="historical-manager">
      {canManage && (
        <div className="section-head">
          <div>
            <p className="muted">
              Registre kicks, expulsões e outros motivos decididos pela liderança.
            </p>
          </div>

          <button
            type="button"
            className="btn primary"
            onClick={startCreating}
            disabled={isPending}
          >
            + Novo registro
          </button>
        </div>
      )}

      {canManage && (creating || editing) && (
        <form
          className="roster-note-form historical-edit-form"
          onSubmit={creating ? handleCreate : handleSave}
        >
          <h3>
            {creating
              ? "Novo registro punitivo"
              : editing?.origin === "automatic"
                ? "Editar punição automática"
                : "Editar registro histórico"}
          </h3>

          {creating && (
            <>
              <label htmlFor="history-type">Tipo de registro</label>
              <select
                id="history-type"
                value={recordType}
                onChange={(event) =>
                  setRecordType(event.target.value as RecordType)
                }
              >
                <option value="Kick / Expulsão">Kick / Expulsão</option>
                <option value="Outro motivo">Outro motivo</option>
              </select>
            </>
          )}

          <label htmlFor="history-member">Nick do jogador</label>
          <input
            id="history-member"
            value={memberName}
            onChange={(event) => setMemberName(event.target.value)}
            maxLength={100}
            required
          />

          <label htmlFor="history-date">Data do registro</label>
          <input
            id="history-date"
            type="date"
            value={dateText}
            onChange={(event) => setDateText(event.target.value)}
          />

          <label htmlFor="history-notes">Motivo / observação</label>
          <textarea
            id="history-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Descreva o motivo do registro..."
          />

          <div className="roster-note-actions">
            <button type="submit" disabled={isPending}>
              {isPending
                ? "Salvando..."
                : creating
                  ? "Criar registro"
                  : "Salvar alterações"}
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
        <p className="muted">Nenhum registro histórico encontrado.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nick</th>
                <th>Tipo</th>
                <th>Data original</th>
                <th>Observação</th>
                {canManage && <th>Ações</th>}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.origin}-${row.id}`}>
                  <td>{index + 1}</td>

                  <td>
                    <b>{row.member_name}</b>
                  </td>

                  <td>
                    {row.origin === "automatic"
                      ? row.punishment_label || "Punição automática"
                      : row.source_label || "Registro histórico"}
                  </td>

                  <td>{formatDate(row.date_text)}</td>

                  <td>
                    {row.origin === "automatic"
                      ? "Não informado"
                      : row.notes || "Não informado"}
                  </td>

                  {canManage && (
                    <td>
                      <div className="roster-note-actions">
                        <button
                          type="button"
                          onClick={() => startEditing(row)}
                          disabled={isPending}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeactivate(row)}
                          disabled={isPending}
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
