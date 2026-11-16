
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
        {
          error:
            "Somente líderes e colíderes ativos podem finalizar a edição.",
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
        { error: "Não existe uma edição ativa para finalizar." },
        { status: 404 }
      );
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

    // 5. Última consulta à API
    const members = await getClanGamesProgress(clanTag);

    if (!Array.isArray(members) || members.length === 0) {
      throw new Error(
        "A API não retornou membros. A edição não foi finalizada."
      );
    }

    const validMembers = members.filter(
      (member) =>
        member.achievementFound === true &&
        typeof member.tag === "string" &&
        typeof member.name === "string" &&
        Number.isFinite(member.achievementValue) &&
        member.achievementValue >= 0
    );

    // 6. Buscar pontuações existentes
    const { data: existingScores, error: scoresError } = await supabase
      .from("clan_games_scores")
      .select("player_tag")
      .eq("edition_id", edition.id);

    if (scoresError) {
      throw new Error(scoresError.message);
    }

    const existingTags = new Set(
      (existingScores ?? []).map((score) => score.player_tag)
    );

    // 7. Atualizar jogadores já registrados
    const updates = await Promise.all(
      validMembers
        .filter((member) => existingTags.has(member.tag))
        .map((member) =>
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

    const updateError = updates.find(
      (result) => result.error
    );

    if (updateError?.error) {
      throw new Error(updateError.error.message);
    }

    // 8. Registrar novos membros com zero pontos na edição
    const newMembers = validMembers.filter(
      (member) => !existingTags.has(member.tag)
    );

    if (newMembers.length > 0) {
      const { error: insertError } = await supabase
        .from("clan_games_scores")
        .insert(
          newMembers.map((member) => ({
            edition_id: edition.id,
            player_tag: member.tag,
            player_name: member.name,
            initial_value: member.achievementValue,
            current_value: member.achievementValue,
          }))
        );

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    // 9. Buscar pontuação final
    const { data: finalScores, error: finalScoresError } =
      await supabase
        .from("clan_games_scores")
        .select(
          "player_tag, player_name, initial_value, current_value"
        )
        .eq("edition_id", edition.id);

    if (finalScoresError) {
      throw new Error(finalScoresError.message);
    }

    const ranking = (finalScores ?? [])
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
        };
      })
      .sort((a, b) => b.points - a.points);

    // 10. Separar resultados
    const notParticipated = ranking.filter(
      (member) => member.points === 0
    );

    const belowGoal = ranking.filter(
      (member) =>
        member.points > 0 &&
        member.points < edition.target_points
    );

    const totalCompleted = ranking.filter(
      (member) => member.points >= edition.target_points
    ).length;

    // 11. Finalizar somente se ainda estiver ativa
    const { data: finishedEdition, error: finishError } =
      await supabase
        .from("clan_games_editions")
        .update({
          status: "finished",
          ends_at: new Date().toISOString(),
        })
        .eq("id", edition.id)
        .eq("status", "active")
        .select("id, name, target_points, status, starts_at, ends_at")
        .maybeSingle();

    if (finishError) {
      throw new Error(finishError.message);
    }

    if (!finishedEdition) {
      return NextResponse.json(
        {
          error:
            "A edição já foi finalizada ou não está mais disponível.",
        },
        { status: 409 }
      );
    }

    // 12. Retornar relatório
    return NextResponse.json({
      success: true,
      message: "Jogos do Clã finalizados com sucesso!",
      edition: finishedEdition,
      totalMembersUpdated: validMembers.length,
      report: {
        ranking,
        notParticipated,
        belowGoal,
        totalNotParticipated: notParticipated.length,
        totalBelowGoal: belowGoal.length,
        totalCompleted,
      },
    });
  } catch (error) {
    console.error("[Clan Games] Erro ao finalizar edição:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao finalizar os Jogos do Clã.",
      },
      { status: 500 }
    );
  }
}
