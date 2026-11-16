
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClanGamesProgress } from "@/lib/clash/raid-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    // 2. Verificar se o perfil está ativo
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "[Clan Games] Erro ao consultar perfil:",
        profileError
      );

      return NextResponse.json(
        { error: "Não foi possível verificar sua autorização." },
        { status: 500 }
      );
    }

    if (profile?.is_active !== true) {
      return NextResponse.json(
        { error: "Usuário sem acesso ativo." },
        { status: 403 }
      );
    }

    // 3. Verificar configuração do clã
    const clanTag =
      process.env.CLASH_OF_CLANS_CLAN_TAG ||
      process.env.CLAN_TAG;

    if (!clanTag) {
      return NextResponse.json(
        { error: "Tag do clã não configurada." },
        { status: 500 }
      );
    }

    // 4. Consultar progresso na API do Clash of Clans
    const members = await getClanGamesProgress(clanTag);

    if (!Array.isArray(members)) {
      throw new Error(
        "A API retornou um formato de dados inválido."
      );
    }

    // 5. Retornar dados
    return NextResponse.json({
      success: true,
      totalMembers: members.length,
      members,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[Clan Games] Erro ao consultar Jogos do Clã:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao consultar os Jogos do Clã.",
      },
      { status: 500 }
    );
  }
}
