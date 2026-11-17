
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClanMembers } from "@/lib/clash/raid-api";
import { normalizeTag } from "@/lib/clash/strategy";

export const dynamic = "force-dynamic";

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
        { error: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    // 2. Consultar perfil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("player_tag, is_active, in_game_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      return NextResponse.json(
        { error: "Perfil não encontrado." },
        { status: 404 }
      );
    }

    // 3. Permitir somente a primeira vinculação de novos cadastros
    const isInitialRegistration =
      profile.is_active === false &&
      !profile.player_tag &&
      profile.in_game_name === "Aguardando vinculação";

    if (!profile.is_active && !isInitialRegistration) {
      return NextResponse.json(
        {
          error:
            "Seu perfil está temporariamente inativo. Entre em contato com a liderança.",
        },
        { status: 403 }
      );
    }

    if (profile.player_tag) {
      return NextResponse.json(
        { error: "Esta conta já possui uma TAG vinculada." },
        { status: 409 }
      );
    }

    // 4. Validar TAG informada
    let body: { playerTag?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corpo da solicitação inválido." },
        { status: 400 }
      );
    }

    const rawTag =
      typeof body?.playerTag === "string"
        ? body.playerTag.trim()
        : "";

    const playerTag = normalizeTag(rawTag);

    if (!/^[0289PYLQGRJCUV]{3,15}$/.test(playerTag)) {
      return NextResponse.json(
        { error: "TAG do Clash inválida." },
        { status: 400 }
      );
    }

    // 5. Consultar configuração do clã
    const clanTag = process.env.CLASH_OF_CLANS_CLAN_TAG;

    if (!clanTag) {
      return NextResponse.json(
        { error: "TAG do clã não configurada no servidor." },
        { status: 500 }
      );
    }

    // 6. Consultar membros oficiais da UPALELE
    const members = await getClanMembers(clanTag);

    const member = members.find(
      (item) => normalizeTag(item.tag) === playerTag
    );

    if (!member) {
      return NextResponse.json(
        { error: "Esta TAG não pertence atualmente ao clã UPALELE." },
        { status: 403 }
      );
    }

    // 7. Criar solicitação de vinculação
    const { data: linkRequest, error: insertError } =
      await supabase
        .from("tag_link_requests")
        .insert({
          user_id: user.id,
          player_tag: `#${playerTag}`,
          in_game_name: member.name,
        })
        .select("id, player_tag, in_game_name, status, created_at")
        .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Você já possui uma solicitação pendente ou esta TAG já está sendo utilizada.",
          },
          { status: 409 }
        );
      }

      throw insertError;
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "TAG validada! Sua solicitação foi enviada para aprovação da liderança.",
        request: linkRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[TAG LINK REQUEST]", error);

    return NextResponse.json(
      {
        error:
          "Não foi possível validar a TAG. Tente novamente mais tarde.",
      },
      { status: 500 }
    );
  }
}
