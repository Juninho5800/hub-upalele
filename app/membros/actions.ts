
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = [
  "newcomer",
  "multiple_accounts",
  "temporary_inactivity",
  "general",
] as const;

type NoteType = (typeof allowedTypes)[number];

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  return { supabase, user };
}

function validateNote(memberName: string, noteType: string) {
  if (!memberName.trim()) {
    throw new Error("Selecione um jogador.");
  }

  if (!allowedTypes.includes(noteType as NoteType)) {
    throw new Error("Selecione uma categoria válida.");
  }
}

export async function createRosterNote(input: {
  memberName: string;
  noteType: string;
  details: string;
}) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    validateNote(input.memberName, input.noteType);

    const { error } = await supabase.from("roster_notes").insert({
      member_name: input.memberName.trim(),
      note_type: input.noteType,
      details: input.details.trim() || null,
      is_active: true,
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/membros");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar a observação.",
    };
  }
}

export async function updateRosterNote(input: {
  id: string;
  memberName: string;
  noteType: string;
  details: string;
}) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    validateNote(input.memberName, input.noteType);

    const { data, error } = await supabase
      .from("roster_notes")
      .update({
        member_name: input.memberName.trim(),
        note_type: input.noteType,
        details: input.details.trim() || null,
        updated_by: user.id,
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

    revalidatePath("/membros");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível editar a observação.",
    };
  }
}

export async function deactivateRosterNote(id: string) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { data, error } = await supabase
      .from("roster_notes")
      .update({
        is_active: false,
        updated_by: user.id,
      })
      .eq("id", id)
      .eq("is_active", true)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      throw new Error(
        "Registro não encontrado ou você não tem permissão para desativá-lo."
      );
    }

    revalidatePath("/membros");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível desativar a observação.",
    };
  }
}
