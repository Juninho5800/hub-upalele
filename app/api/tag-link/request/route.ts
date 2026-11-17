
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClanMembers } from "@/lib/clash/raid-api";
import { normalizeTag } from "@/lib/clash/strategy";

export const dynamic = "force-dynamic";


export async function POST(request: Request) {
  try {
    const clanTag = process.env.CLASH_OF_CLANS_CLAN_TAG;

    if (!clanTag) {
      return NextResponse.json(
        { error: "TAG do clã não configurada no servidor." },
        { status: 500 }
      );
    }

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

    // 2. Ler e validar a TAG informada
    const body = await request.json();
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

    // 3. Verificar se o perfil existe e ainda não está vinculado
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("player_tag")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Perfil não encontrado." },
        { status: 404 }
      );
    }

    if (profile.player_tag) {
      return NextResponse.json(
        { error: "Esta conta já possui uma TAG vinculada." },
        { status: 409 }
      );
    }

    // 4. Consultar os membros oficiais da UPALELE
   const members = await getClanMembers(clanTag);

    const member = members.find(
      (item) => normalizeTag(item.tag) === playerTag
    );

    if (!member) {
      return NextResponse.json(
        {
          error:
            "Esta TAG não pertence atualmente ao clã UPALELE.",
        },
        { status: 403 }
      );
    }

    // 5. Criar solicitação de vinculação
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
