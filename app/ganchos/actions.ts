
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Sua sessão expirou. Entre novamente.");

  return { supabase, user };
}

export async function updateHook(input: {
  id: string;
  member_name: string;
  punishment_label: string;
  duration_wars: number | null;
  reason: string;
  return_date: string;
  source_note: string;
}) {
  try {
    if (!UUID_PATTERN.test(input.id)) {
      throw new Error("Identificador de registro inválido.");
    }

    const memberName = input.member_name.trim();
    const punishmentLabel = input.punishment_label.trim();

    if (!memberName || !punishmentLabel) {
      throw new Error("Preencha o membro e a punição.");
    }

    if (
      memberName.length > 200 ||
      punishmentLabel.length > 200 ||
      input.reason.length > 5000 ||
      input.source_note.length > 5000
    ) {
      throw new Error("Um dos campos excede o limite permitido.");
    }

    if (
      input.duration_wars !== null &&
      (!Number.isInteger(input.duration_wars) ||
        input.duration_wars < 0 ||
        input.duration_wars > 10000)
    ) {
      throw new Error("A duração deve ser um número inteiro válido.");
    }

    if (
      input.return_date &&
      !/^\d{4}-\d{2}-\d{2}$/.test(input.return_date)
    ) {
      throw new Error("A data de retorno é inválida.");
    }

    const { supabase, user } = await getAuthenticatedClient();

    const { data, error } = await supabase
      .from("punishments")
      .update({
        member_name: memberName,
        punishment_label: punishmentLabel,
        duration_wars: input.duration_wars,
        reason: input.reason.trim() || null,
        return_date: input.return_date || null,
        source_note: input.source_note.trim() || null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      throw new Error(
        "Registro não encontrado, já não está ativo ou você não tem permissão."
      );
    }

    revalidatePath("/ganchos");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o gancho.",
    };
  }
}

export async function cancelHook(id: string) {
  try {
    if (!UUID_PATTERN.test(id)) {
      throw new Error("Identificador de registro inválido.");
    }

    const { supabase, user } = await getAuthenticatedClient();

    const { data, error } = await supabase
      .from("punishments")
      .update({
        status: "cancelled",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      throw new Error(
        "Registro não encontrado, já não está ativo ou você não tem permissão."
      );
    }

    revalidatePath("/ganchos");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível cancelar o gancho.",
    };
  }
}
