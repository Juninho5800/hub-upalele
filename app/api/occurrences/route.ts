
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const allowedTypes = new Set([
  "strategy_error",
  "missed_attack",
  "conduct",
  "other",
]);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Você precisa estar autenticado." },
        { status: 401 }
      );
    }

    // 2. Consultar perfil e autorização
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "[Occurrences] Erro ao consultar perfil:",
        profileError
      );

      return NextResponse.json(
        { error: "Não foi possível verificar sua autorização." },
        { status: 500 }
      );
    }

    const isLeader =
      profile?.role === "leader" ||
      profile?.role === "co_leader";

    if (profile?.is_active !== true || !isLeader) {
      return NextResponse.json(
        {
          error:
            "Somente a liderança ativa pode registrar ocorrências.",
        },
        { status: 403 }
      );
    }

    // 3. Processar formulário
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Dados do formulário inválidos." },
        { status: 400 }
      );
    }

    const getText = (key: string, maxLength: number) => {
      const value = formData.get(key);

      return typeof value === "string"
        ? value.trim().slice(0, maxLength)
        : "";
    };

    const title = getText("title", 150);
    const occurrenceType = getText("occurrence_type", 50);
    const description = getText("description", 5000);

    if (
      !title ||
      !description ||
      !allowedTypes.has(occurrenceType)
    ) {
      return NextResponse.json(
        {
          error:
            "Preencha o título, a descrição e um tipo válido.",
        },
        { status: 400 }
      );
    }

    // 4. Validar número do ataque
    const attackValue = getText("attack_number", 10);

    if (
      attackValue !== "" &&
      attackValue !== "1" &&
      attackValue !== "2"
    ) {
      return NextResponse.json(
        { error: "Número de ataque inválido." },
        { status: 400 }
      );
    }

    const attackNumber =
      attackValue === "" ? null : Number(attackValue);

    // 5. Registrar ocorrência
    const { error: insertError } = await supabase
      .from("war_occurrences")
      .insert({
        title,
        occurrence_type: occurrenceType,
        status: "pending",
        player_name: getText("player_name", 100) || null,
        player_tag: getText("player_tag", 20) || null,
        attack_number: attackNumber,
        attacked_target_name:
          getText("attacked_target_name", 100) || null,
        expected_target_name:
          getText("expected_target_name", 100) || null,
        rule_reference: getText("rule_reference", 100) || null,
        description,
        created_by: user.id,
      });

    if (insertError) {
      console.error(
        "[Occurrences] Erro ao registrar:",
        insertError
      );

      return NextResponse.json(
        { error: "Não foi possível salvar a ocorrência." },
        { status: 500 }
      );
    }

    // 6. Redirecionar após sucesso
    return NextResponse.redirect(
      new URL("/ocorrencias?created=1", request.url),
      303
    );
  } catch (error) {
    console.error("[Occurrences] Erro inesperado:", error);

    return NextResponse.json(
      { error: "Ocorreu um erro inesperado ao registrar a ocorrência." },
      { status: 500 }
    );
  }
}
