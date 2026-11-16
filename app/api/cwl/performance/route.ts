import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getActiveProfileClient() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      response: NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Erro ao consultar perfil CWL:", profileError);

    return {
      supabase,
      response: NextResponse.json(
        { error: "Não foi possível validar suas permissões." },
        { status: 500 }
      ),
    };
  }

  if (profile?.is_active !== true || !profile.role) {
    return {
      supabase,
      response: NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 }
      ),
    };
  }

  return { supabase, response: null };
}

export async function GET(request: Request) {
  try {
    const auth = await getActiveProfileClient();

    if (auth.response) return auth.response;

    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get("roundId")?.trim();

    if (!roundId) {
      return NextResponse.json(
        { error: "Informe o roundId." },
        { status: 400 }
      );
    }

    const { data: round, error: roundError } = await supabase
      .from("cwl_rounds")
      .select("id,season_id,round_number,status,war_id")
      .eq("id", roundId)
      .maybeSingle();

    if (roundError) throw roundError;

    if (!round) {
      return NextResponse.json(
        { error: "Rodada não encontrada." },
        { status: 404 }
      );
    }

    const { data: lineups, error: lineupsError } = await supabase
      .from("cwl_lineups")
      .select("participant_id,role,slot_position,status")
      .eq("round_id", roundId)
      .eq("status", "active");

    if (lineupsError) throw lineupsError;

    if (!lineups?.length) {
      return NextResponse.json({
        success: true,
        round,
        players: [],
        processed: false,
        message: "A rodada ainda não possui participantes na escalação.",
        summary: {
          totalPlayers: 0,
          processedPlayers: 0,
          completePlayers: 0,
          pendingPlayers: 0,
          protectedPlayers: 0,
        },
      });
    }

    const participantIds = [
      ...new Set(lineups.map((item) => item.participant_id)),
    ];

    const { data: participants, error: participantsError } =
      await supabase
        .from("cwl_participants")
        .select(
          "id,player_name,player_tag,town_hall_level,selection_position"
        )
        .eq("season_id", round.season_id)
        .in("id", participantIds);

    if (participantsError) throw participantsError;

    const { data: performance, error: performanceError } =
      await supabase
        .from("cwl_performance")
        .select(
          "participant_id,attack_confirmed,attack_stars,attack_destruction,defense_confirmed,defense_stars,defense_destruction,attack_index,defense_index,ad_index,is_protected,data_complete,rotation_score,calculated_at"
        )
        .eq("round_id", roundId);

    if (performanceError) throw performanceError;

    const participantMap = new Map(
      (participants ?? []).map((item) => [item.id, item])
    );

    const missingParticipants = participantIds.filter(
      (id) => !participantMap.has(id)
    );

    if (missingParticipants.length > 0) {
      console.error(
        "Participantes CWL não encontrados:",
        missingParticipants
      );

      return NextResponse.json(
        {
          error:
            "Existem participantes vinculados à escalação que não foram encontrados na temporada.",
          missingParticipants,
        },
        { status: 409 }
      );
    }

    const lineupMap = new Map(
      lineups.map((item) => [item.participant_id, item])
    );

    const performanceMap = new Map(
      (performance ?? []).map((item) => [
        item.participant_id,
        item,
      ])
    );

    const players = (participants ?? [])
      .filter((player) => lineupMap.has(player.id))
      .map((player) => {
        const playerPerformance =
          performanceMap.get(player.id) ?? null;

        const isProtected =
          playerPerformance?.attack_confirmed === true &&
          Number(playerPerformance.attack_stars) === 3;

        return {
          ...player,
          lineup: lineupMap.get(player.id),
          performance: playerPerformance
            ? {
                ...playerPerformance,
                is_protected: isProtected,
              }
            : null,
        };
      })
      .sort((a, b) => {
        const aScore = a.performance?.ad_index;
        const bScore = b.performance?.ad_index;

        if (aScore == null && bScore == null) {
          return (
            (a.lineup?.slot_position ?? 999) -
            (b.lineup?.slot_position ?? 999)
          );
        }

        if (aScore == null) return 1;
        if (bScore == null) return -1;

        return Number(bScore) - Number(aScore);
      });

    const processedCount = players.filter(
      (player) => player.performance !== null
    ).length;

    const completeCount = players.filter(
      (player) => player.performance?.data_complete === true
    ).length;

    const protectedCount = players.filter(
      (player) => player.performance?.is_protected === true
    ).length;

    return NextResponse.json({
      success: true,
      round,
      players,
      processed: processedCount > 0,
      summary: {
        totalPlayers: players.length,
        processedPlayers: processedCount,
        completePlayers: completeCount,
        pendingPlayers: Math.max(
          players.length - completeCount,
          0
        ),
        protectedPlayers: protectedCount,
      },
    });
  } catch (error) {
    console.error("Erro ao consultar desempenho CWL:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar o desempenho.",
      },
      { status: 500 }
    );
  }
}
