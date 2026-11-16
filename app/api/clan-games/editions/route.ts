
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClanGamesProgress } from "@/lib/clash/raid-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let createdEditionId: string | null = null;

  try {
    supabase = await createClient();

    // 1. Autenticação
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

    // 2. Verificar perfil e autorização
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[Clan Games] Erro ao consultar perfil:", profileError);

      return NextResponse.json(
        { error: "Não foi possível verificar sua autorização." },
        { status: 500 }
      );
    }

    if (
      profile?.is_active !== true ||
      !["leader", "co_leader"].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: "Somente líderes e colíderes ativos podem iniciar uma edição." },
        { status: 403 }
      );
    }

    // 3. Verificar edição ativa
    const { data: activeEdition, error: activeEditionError } =
      await supabase
        .from("clan_games_editions")
        .select("id")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

    if (activeEditionError) {
      console.error(
        "[Clan Games] Erro ao verificar edição ativa:",
        activeEditionError
      );

      return NextResponse.json(
        { error: "Não foi possível verificar as edições existentes." },
        { status: 500 }
      );
    }

    if (activeEdition) {
      return NextResponse.json(
        { error: "Já existe uma edição dos Jogos do Clã em andamento." },
        { status: 409 }
      );
    }

    // 4. Validar dados recebidos
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Dados da requisição inválidos." },
        { status: 400 }
      );
    }

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Formato de dados inválido." },
        { status: 400 }
      );
    }

    const rawName = (body as { name?: unknown }).name;

    if (
      rawName !== undefined &&
      typeof rawName !== "string"
    ) {
      return NextResponse.json(
        { error: "Nome da edição inválido." },
        { status: 400 }
      );
    }

    const name =
      typeof rawName === "string" && rawName.trim()
        ? rawName.trim()
        : `Jogos do Clã - ${new Date().toLocaleDateString("pt-BR")}`;

    if (name.length > 100) {
      return NextResponse.json(
        { error: "O nome da edição deve ter no máximo 100 caracteres." },
        { status: 400 }
      );
    }

    const targetPoints = 5000;

    // 5. Verificar configuração do clã
    const clanTag =
      process.env.CLASH_OF_CLANS_CLAN_TAG ||
      process.env.CLAN_TAG;

    if (!clanTag) {
      return NextResponse.json(
        { error: "Tag do clã não configurada." },
        { status: 500 }
      );
    }

    // 6. Buscar pontuação atual dos membros
    const members = await getClanGamesProgress(clanTag);

    if (!members || members.length === 0) {
      return NextResponse.json(
        { error: "Nenhum membro foi encontrado no clã." },
        { status: 400 }
      );
    }

    // 7. Criar edição
    const { data: edition, error: editionError } = await supabase
      .from("clan_games_editions")
      .insert({
        name,
        target_points: targetPoints,
        status: "active",
        created_by: user.id,
      })
      .select("id, name, target_points, status, starts_at")
      .single();

    if (editionError || !edition) {
      throw new Error(
        editionError?.message || "Não foi possível criar a edição."
      );
    }

    createdEditionId = edition.id;

    // 8. Registrar pontuação inicial dos membros
    const scores = members.map((member) => ({
      edition_id: edition.id,
      player_tag: member.tag,
      player_name: member.name,
      initial_value: member.achievementValue,
      current_value: member.achievementValue,
    }));

    const { error: scoresError } = await supabase
      .from("clan_games_scores")
      .insert(scores);

    if (scoresError) {
      throw new Error(scoresError.message);
    }

    return NextResponse.json({
      success: true,
      message: "Edição iniciada e pontuações iniciais registradas.",
      edition,
      totalMembers: members.length,
    });
  } catch (error) {
    // 9. Tentar remover edição incompleta
    if (supabase && createdEditionId) {
      const { error: rollbackError } = await supabase
        .from("clan_games_editions")
        .delete()
        .eq("id", createdEditionId);

      if (rollbackError) {
        console.error(
          "[Clan Games] Falha ao remover edição incompleta:",
          rollbackError
        );
      }
    }

    console.error("[Clan Games] Erro ao iniciar edição:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao iniciar os Jogos do Clã.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Autenticação
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

    // 2. Verificar perfil ativo
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[Clan Games] Erro ao consultar perfil:", profileError);

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

    // 3. Consultar edição ativa
    const { data: edition, error: editionError } = await supabase
      .from("clan_games_editions")
      .select("*")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (editionError) {
      throw new Error(editionError.message);
    }

    const canManage = ["leader", "co_leader"].includes(profile.role);

    if (!edition) {
      return NextResponse.json({
        success: true,
        edition: null,
        ranking: [],
        totalPoints: 0,
        membersAtGoal: 0,
        canManage,
      });
    }

    // 4. Consultar pontuações
    const { data: scores, error: scoresError } = await supabase
      .from("clan_games_scores")
      .select("*")
      .eq("edition_id", edition.id);

    if (scoresError) {
      throw new Error(scoresError.message);
    }

    // 5. Montar ranking
    const ranking = (scores ?? [])
      .map((member) => {
        const points = Math.max(
          0,
          member.current_value - member.initial_value
        );

        return {
          tag: member.player_tag,
          name: member.player_name,
          points,
          targetPoints: edition.target_points,
          progress: Math.min(
            100,
            Math.round(
              (points / edition.target_points) * 100
            )
          ),
          completed: points >= edition.target_points,
        };
      })
      .sort((a, b) => b.points - a.points);

    return NextResponse.json({
      success: true,
      edition,
      ranking,
      totalPoints: ranking.reduce(
        (total, member) => total + member.points,
        0
      ),
      membersAtGoal: ranking.filter(
        (member) => member.completed
      ).length,
      canManage,
    });
  } catch (error) {
    console.error("[Clan Games] Erro ao consultar ranking:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao consultar ranking.",
      },
      { status: 500 }
    );
  }
}
