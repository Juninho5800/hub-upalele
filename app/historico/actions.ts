"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_NAME_LENGTH = 100;
const MAX_DATE_LENGTH = 100;
const MAX_NOTES_LENGTH = 2000;

type HistoricalRecordType = "Kick / Expulsão" | "Outro motivo";

async function getAuthorizedClient() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error("Não foi possível validar seu perfil.");
  }

  if (!profile?.is_active) {
    throw new Error("Seu perfil está inativo.");
  }

  const role = (profile.role ?? "").trim().toLowerCase();
  const canManage = ["leader", "co_leader", "coleader"].includes(role);

  if (!canManage) {
    throw new Error("Somente a liderança pode gerenciar o histórico.");
  }

  return { supabase, user };
}

function validateFields(input: {
  memberName: string;
  dateText: string;
  notes: string;
}) {
  const memberName = input.memberName.trim();
  const dateText = input.dateText.trim();
  const notes = input.notes.trim();

  if (!memberName) {
    throw new Error("O nick do jogador é obrigatório.");
  }

  if (
    memberName.length > MAX_NAME_LENGTH ||
    dateText.length > MAX_DATE_LENGTH ||
    notes.length > MAX_NOTES_LENGTH
  ) {
    throw new Error("Um dos campos excede o limite permitido.");
  }

  return {
    member_name: memberName,
    date_text: dateText || null,
    notes: notes || null,
  };
}

function validateAutomaticFields(input: {
  memberName: string;
  dateText: string;
  notes: string;
}) {
  const memberName = input.memberName.trim();
  const dateText = input.dateText.trim();
  const notes = input.notes.trim();

  if (!memberName) {
    throw new Error("O nick do jogador é obrigatório.");
  }

  if (
    memberName.length > MAX_NAME_LENGTH ||
    dateText.length > 10 ||
    notes.length > MAX_NOTES_LENGTH
  ) {
    throw new Error("Um dos campos excede o limite permitido.");
  }

  if (dateText && !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error("A data da punição está em formato inválido.");
  }

  return {
    member_name: memberName,
    applied_on: dateText || null,
    reason: notes || null,
  };
}

// Cria um registro manual no histórico, sem executar kick no jogo.
export async function createHistoricalRecord(input: {
  memberName: string;
  dateText: string;
  notes: string;
  recordType: HistoricalRecordType;
}) {
  try {
    if (!["Kick / Expulsão", "Outro motivo"].includes(input.recordType)) {
      throw new Error("Tipo de registro inválido.");
    }

    const fields = validateFields(input);
    const { supabase } = await getAuthorizedClient();

    const { data: lastRecord, error: orderError } = await supabase
      .from("historical_punishment_records")
      .select("source_order")
      .order("source_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) {
      throw new Error("Não foi possível determinar a posição do registro.");
    }

    const nextOrder = (lastRecord?.source_order ?? 0) + 1;

    const { data, error } = await supabase
      .from("historical_punishment_records")
      .insert({
        ...fields,
        source_order: nextOrder,
        source_label: input.recordType,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("O registro não foi criado.");

    revalidatePath("/historico");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível criar o registro histórico.",
    };
  }
}

// Edita um registro histórico antigo.
export async function updateHistoricalRecord(input: {
  id: string;
  memberName: string;
  dateText: string;
  notes: string;
}) {
  try {
    if (!UUID_PATTERN.test(input.id)) {
      throw new Error("Identificador de registro inválido.");
    }

    const fields = validateFields(input);
    const { supabase } = await getAuthorizedClient();

    const { data, error } = await supabase
      .from("historical_punishment_records")
      .update({
        ...fields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("is_active", true)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      throw new Error(
        "Registro não encontrado ou você não tem permissão para editá-lo."
      );
    }

    revalidatePath("/historico");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o registro.",
    };
  }
}

// Anula um registro histórico antigo, sem apagá-lo.
export async function deactivateHistoricalRecord(id: string) {
  try {
    if (!UUID_PATTERN.test(id)) {
      throw new Error("Identificador de registro inválido.");
    }

    const { supabase } = await getAuthorizedClient();

    const { data, error } = await supabase
      .from("historical_punishment_records")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("is_active", true)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      throw new Error(
        "Registro não encontrado ou você não tem permissão para anulá-lo."
      );
    }

    revalidatePath("/historico");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível anular o registro.",
    };
  }
}

// Edita diretamente a punição original criada pela votação.
export async function updateAutomaticPunishment(input: {
  id: string;
  memberName: string;
  dateText: string;
  notes: string;
}) {
  try {
    if (!UUID_PATTERN.test(input.id)) {
      throw new Error("Identificador de punição inválido.");
    }

    const fields = validateAutomaticFields(input);
    const { supabase, user } = await getAuthorizedClient();

    const { data, error } = await supabase
      .from("punishments")
      .update({
        ...fields,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .neq("status", "cancelled")
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      throw new Error("Punição não encontrada ou já anulada.");
    }

    revalidatePath("/historico");
    revalidatePath("/ganchos");

    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a punição automática.",
    };
  }
}

// Anula a punição original, preservando o registro no banco.
export async function deactivateAutomaticPunishment(id: string) {
  try {
    if (!UUID_PATTERN.test(id)) {
      throw new Error("Identificador de punição inválido.");
    }

    const { supabase, user } = await getAuthorizedClient();

    const { data, error } = await supabase
      .from("punishments")
      .update({
        status: "cancelled",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .neq("status", "cancelled")
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      throw new Error("Punição não encontrada ou já anulada.");
    }

    revalidatePath("/historico");
    revalidatePath("/ganchos");

    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível anular a punição.",
    };
  }
}
