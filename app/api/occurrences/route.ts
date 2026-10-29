
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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Você precisa estar autenticado." },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  const isLeader =
    profile?.role === "leader" ||
    profile?.role === "co_leader";

  if (!profile?.is_active || !isLeader) {
    return NextResponse.json(
      { error: "Somente a liderança ativa pode registrar ocorrências." },
      { status: 403 }
    );
  }

  const formData = await request.formData();

  const getText = (key: string, maxLength: number) => {
    const value = formData.get(key);
    return typeof value === "string"
      ? value.trim().slice(0, maxLength)
      : "";
  };

  const title = getText("title", 150);
  const occurrenceType = getText("occurrence_type", 50);
  const description = getText("description", 5000);

  if (!title || !description || !allowedTypes.has(occurrenceType)) {
    return NextResponse.json(
      { error: "Preencha o título, a descrição e um tipo válido." },
      { status: 400 }
    );
  }

  const attackValue = getText("attack_number", 1);
  const attackNumber =
    attackValue === "1" || attackValue === "2"
      ? Number(attackValue)
      : null;

  const { error } = await supabase
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

  if (error) {
    console.error("[Occurrences] Erro ao registrar:", error);

    return NextResponse.json(
      { error: "Não foi possível salvar a ocorrência." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(
    new URL("/ocorrencias?created=1", request.url),
    303
  );
}
