
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClanGamesProgress } from "@/lib/clash/raid-api";

export const dynamic = "force-dynamic";

export async function POST() {
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

    // 2. Verificar perfil e autorização
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
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

    if (
      profile?.is_active !== true ||
      !["leader", "co_leader"].includes(profile.role)
    ) {
      return NextResponse.json(
        {
          error:
            "Somente líderes e colíderes ativos podem atualizar as pontuações.",
        },
        { status: 403 }
      );
    }

    // 3. Buscar edição ativa
    const { data: edition, error: editionError } = await supabase
      .from("clan_games_editions")
      .select("id, name, target_points")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (editionError) {
      throw new Error(editionError.message);
    }

    if (!edition) {
      return NextResponse.json(
        { error: "Não existe uma edição ativa dos Jogos do Clã." },
        { status: 404 }
      );
    }

    if (
      !Number.isFinite(edition.target_points) ||
      edition.target_points <= 0
    ) {
      throw new Error("A meta de pontuação da edição é inválida.");
    }

    // 4. Verificar configuração do clã
    const clanTag =
      process.env.CLASH_OF_CLANS_CLAN_TAG ||
      process.env.CLAN_TAG;

    if (!clanTag) {
      return NextResponse.json(
        { error: "Tag do clã não configurada." },
        { status: 500 }
      );
    }

    // 5. Consultar API do Clash of Clans
    const members = await getClanGamesProgress(clanTag);

    if (!Array.isArray(members) || members.length === 0) {
      throw new Error(
        "A API não retornou membros. Nenhuma pontuação foi atualizada."
      );
    }

    // 6. Separar dados válidos e conquistas não encontradas
    const validMembers = members.filter(
      (member) =>
        member.achievementFound === true &&
        typeof member.tag === "string" &&
        member.tag.trim().length > 0 &&
        typeof member.name === "string" &&
        member.name.trim().length > 0 &&
        Number.isFinite(member.achievementValue) &&
        member.achievementValue >= 0
    );

    const missingAchievements = members
      .filter((member) => !member.achievementFound)
      .map((member) => member.name);

    if (validMembers.length === 0) {
      throw new Error(
        "Nenhuma conquista válida foi encontrada. As pontuações foram preservadas."
      );
    }

    // 7. Buscar jogadores já registrados
    const { data: existingScores, error: scoresError } =
      await supabase
        .from("clan_games_scores")
        .select("player_tag, initial_value")
        .eq("edition_id", edition.id);

    if (scoresError) {
      throw new Error(scoresError.message);
    }

    const existingMap = new Map(
      (existingScores ?? []).map((score) => [
        score.player_tag,
        score.initial_value,
      ])
    );

    const updates = validMembers.filter((member) =>
      existingMap.has(member.tag)
    );

    const newMembers = validMembers.filter(
      (member) => !existingMap.has(member.tag)
    );

    // 8. Atualizar jogadores existentes
    const updateResults = await Promise.all(
      updates.map((member) =>
        supabase
          .from("clan_games_scores")
          .update({
            player_name: member.name,
            current_value: member.achievementValue,
            updated_at: new Date().toISOString(),
          })
          .eq("edition_id", edition.id)
          .eq("player_tag", member.tag)
      )
    );

    const updateError = updateResults.find(
      (result) => result.error
    );

    if (updateError?.error) {
      throw new Error(updateError.error.message);
    }

    // 9. Registrar novos membros com pontuação inicial
    if (newMembers.length > 0) {
      const newScores = newMembers.map((member) => ({
        edition_id: edition.id,
        player_tag: member.tag,
        player_name: member.name,
        initial_value: member.achievementValue,
        current_value: member.achievementValue,
      }));

      const { error: insertError } = await supabase
        .from("clan_games_scores")
        .insert(newScores);

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    // 10. Calcular ranking
    const ranking = validMembers.map((member) => {
      const initialValue =
        existingMap.get(member.tag) ?? member.achievementValue;

      const points = Math.max(
        0,
        member.achievementValue - initialValue
      );

      return {
        tag: member.tag,
        name: member.name,
        initialValue,
        currentValue: member.achievementValue,
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
    });

    ranking.sort((a, b) => b.points - a.points);

    // 11. Retornar resultado
    return NextResponse.json({
      success: true,
      edition,
      totalMembers: ranking.length,
      totalPoints: ranking.reduce(
        (total, member) => total + member.points,
        0
      ),
      membersAtGoal: ranking.filter(
        (member) => member.completed
      ).length,
      missingAchievements,
      ranking,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[Clan Games] Erro ao atualizar pontuações:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar as pontuações.",
      },
      { status: 500 }
    );
  }
}
