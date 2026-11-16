import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeTag } from "@/lib/clash/strategy";

export const dynamic = "force-dynamic";

async function getLeadershipClient() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "NÃ£o autenticado." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao consultar perfil para processamento CWL:", error);
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "NÃ£o foi possÃ­vel validar as permissÃµes." },
        { status: 500 }
      ),
    };
  }

  if (
    !profile?.is_active ||
    !["leader", "co_leader"].includes(profile.role)
  ) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "Sem permissÃ£o para processar a CWL." },
        { status: 403 }
      ),
    };
  }

  return { supabase, user, response: null };
}

export async function POST(request: Request) {
  const auth = await getLeadershipClient();

  if (auth.response) return auth.response;

  let processingRunId: string | null = null;
  let roundId = "";

  try {
    let body: { roundId?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corpo da requisiÃ§Ã£o invÃ¡lido." },
        { status: 400 }
      );
    }

    roundId =
      typeof body.roundId === "string" ? body.roundId.trim() : "";

    if (!roundId) {
      return NextResponse.json(
        { error: "Informe o roundId." },
        { status: 400 }
      );
    }

    // 1. Busca a rodada.
    const { data: round, error: roundError } = await auth.supabase
      .from("cwl_rounds")
      .select("id,season_id,round_number,war_id,status")
      .eq("id", roundId)
      .maybeSingle();

    if (roundError) throw roundError;

    if (!round) {
      return NextResponse.json(
        { error: "Rodada CWL nÃ£o encontrada." },
        { status: 404 }
      );
    }

    if (round.status === "processing") {
      return NextResponse.json(
        { error: "Esta rodada jÃ¡ estÃ¡ em processamento." },
        { status: 409 }
      );
    }

    if (!round.war_id) {
      return NextResponse.json(
        { error: "A rodada ainda nÃ£o possui uma guerra sincronizada." },
        { status: 409 }
      );
    }

    // 2. A guerra precisa estar encerrada.
    const { data: war, error: warError } = await auth.supabase
      .from("wars")
      .select("id,status,war_end")
      .eq("id", round.war_id)
      .maybeSingle();

    if (warError) throw warError;

    if (!war || war.status !== "ended") {
      return NextResponse.json(
        {
          error:
            "O processamento sÃ³ pode ocorrer apÃ³s o encerramento da guerra.",
        },
        { status: 409 }
      );
    }

    // 3. Busca TODOS os participantes vinculados Ã  rodada.
    // NÃ£o filtra status active: jogadores substituÃdos tambÃ©m
    // precisam ter seu desempenho processado.
    const { data: roundLineups, error: lineupError } =
      await auth.supabase
        .from("cwl_lineups")
        .select("participant_id")
        .eq("round_id", roundId);

    if (lineupError) throw lineupError;

    if (!roundLineups?.length) {
      return NextResponse.json(
        {
          error:
            "A rodada ainda nÃ£o possui participantes vinculados.",
        },
        { status: 409 }
      );
    }

    const participantIds = [
      ...new Set(roundLineups.map((item) => item.participant_id)),
    ];

    // 4. Busca os participantes da temporada.
    const { data: participants, error: participantsError } =
      await auth.supabase
        .from("cwl_participants")
        .select("id,player_tag,player_name")
        .eq("season_id", round.season_id)
        .in("id", participantIds);

    if (participantsError) throw participantsError;

    if (!participants?.length) {
      throw new Error(
        "Nenhum participante vÃ¡lido foi encontrado para esta rodada."
      );
    }

    if (participants.length !== participantIds.length) {
      const foundIds = new Set(participants.map((item) => item.id));

      const missingIds = participantIds.filter(
        (id) => !foundIds.has(id)
      );

      throw new Error(
        `Existem participantes da escalaÃ§Ã£o que nÃ£o foram encontrados na temporada: ${missingIds.join(", ")}`
      );
    }

    // 5. Busca os ataques da guerra.
    const { data: attacks, error: attacksError } =
      await auth.supabase
        .from("war_attacks")
        .select(
          "attacker_tag,attacker_name,defender_tag,defender_name,stars,destruction_percent"
        )
        .eq("war_id", war.id);

    if (attacksError) throw attacksError;

    // 6. Organiza ataques por jogador.
    const attacksByPlayer = new Map<
      string,
      NonNullable<typeof attacks>
    >();

    const defensesByPlayer = new Map<
      string,
      NonNullable<typeof attacks>
    >();

    for (const attack of attacks ?? []) {
      const attackerTag = attack.attacker_tag
        ? normalizeTag(attack.attacker_tag)
        : "";

      const defenderTag = attack.defender_tag
        ? normalizeTag(attack.defender_tag)
        : "";

      if (attackerTag) {
        const current = attacksByPlayer.get(attackerTag) ?? [];
        current.push(attack);
        attacksByPlayer.set(attackerTag, current);
      }

      if (defenderTag) {
        const current = defensesByPlayer.get(defenderTag) ?? [];
        current.push(attack);
        defensesByPlayer.set(defenderTag, current);
      }
    }

    // 7. Registra a execuÃ§Ã£o.
    const { data: run, error: runError } = await auth.supabase
      .from("cwl_processing_runs")
      .insert({
        round_id: roundId,
        status: "syncing",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runError) throw runError;

    processingRunId = run.id;

    const { error: roundStatusError } = await auth.supabase
      .from("cwl_rounds")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", roundId);

    if (roundStatusError) throw roundStatusError;

    const { error: validatingError } = await auth.supabase
      .from("cwl_processing_runs")
      .update({ status: "validating" })
      .eq("id", processingRunId);

    if (validatingError) throw validatingError;

    // 8. Calcula o desempenho de todos os participantes.
    const calculatedAt = new Date().toISOString();

    const performanceRows = participants.map((participant) => {
      const tag = normalizeTag(participant.player_tag);

      const playerAttacks = attacksByPlayer.get(tag) ?? [];
      const playerDefenses = defensesByPlayer.get(tag) ?? [];

      // NÃ£o aceita ataques prÃ³prios duplicados.
      if (playerAttacks.length > 1) {
        throw new Error(
          `Mais de um ataque prÃ³prio encontrado para ${participant.player_name}.`
        );
      }

      // NÃ£o aceita mais de uma defesa recebida.
      if (playerDefenses.length > 1) {
        throw new Error(
          `Mais de um ataque defensivo encontrado para ${participant.player_name}.`
        );
      }

      const ownAttack =
        playerAttacks.length === 1 ? playerAttacks[0] : null;

      const receivedAttack =
        playerDefenses.length === 1 ? playerDefenses[0] : null;

      const attackConfirmed =
        Boolean(ownAttack) &&
        ownAttack!.stars !== null &&
        ownAttack!.stars !== undefined &&
        ownAttack!.destruction_percent !== null &&
        ownAttack!.destruction_percent !== undefined;

      // Sem defesa recebida:
      // destruiÃ§Ã£o sofrida = 0 e Ãndice defensivo = 100.
      const defenseConfirmed =
        playerDefenses.length === 0 ||
        (
          Boolean(receivedAttack) &&
          receivedAttack!.stars !== null &&
          receivedAttack!.stars !== undefined &&
          receivedAttack!.destruction_percent !== null &&
          receivedAttack!.destruction_percent !== undefined
        );

      const attackDestruction = attackConfirmed
        ? Number(ownAttack!.destruction_percent)
        : null;

      const defenseDestruction =
        playerDefenses.length === 0
          ? 0
          : defenseConfirmed
            ? Number(receivedAttack!.destruction_percent)
            : null;

      const attackStars = attackConfirmed
        ? Number(ownAttack!.stars)
        : null;

      const defenseStars =
        playerDefenses.length === 0
          ? 0
          : defenseConfirmed
            ? Number(receivedAttack!.stars)
            : null;

      const attackIndex = attackDestruction;

      const defenseIndex =
        defenseDestruction === null
          ? null
          : 100 - defenseDestruction;

      const adIndex =
        attackIndex === null || defenseIndex === null
          ? null
          : Number((attackIndex + defenseIndex).toFixed(2));

      // ProteÃ§Ã£o exclusiva para ataque confirmado de 3 estrelas.
      const isProtected =
        attackConfirmed && attackStars === 3;

      return {
        round_id: roundId,
        participant_id: participant.id,

        attack_confirmed: attackConfirmed,
        attack_stars: attackStars,
        attack_destruction: attackDestruction,

        defense_confirmed: defenseConfirmed,
        defense_stars: defenseStars,
        defense_destruction: defenseDestruction,

        attack_index: attackIndex,
        defense_index: defenseIndex,
        ad_index: adIndex,

        is_protected: isProtected,
        data_complete: attackConfirmed && defenseConfirmed,

        calculated_at: calculatedAt,
        updated_at: calculatedAt,
      };
    });

    // 9. Grava ou atualiza os dados de desempenho.
    const { error: performanceError } = await auth.supabase
      .from("cwl_performance")
      .upsert(performanceRows, {
        onConflict: "round_id,participant_id",
      });

    if (performanceError) throw performanceError;

    const completeCount = performanceRows.filter(
      (item) => item.data_complete
    ).length;

    const pendingCount =
      performanceRows.length - completeCount;

    const protectedCount = performanceRows.filter(
      (item) => item.is_protected
    ).length;

    // 10. Finaliza a execuÃ§Ã£o.
    const completedAt = new Date().toISOString();

    const { error: finishRunError } = await auth.supabase
      .from("cwl_processing_runs")
      .update({
        status: "processed",
        completed_at: completedAt,
        error_message: null,
      })
      .eq("id", processingRunId);

    if (finishRunError) throw finishRunError;

    // 11. Finaliza a rodada.
    const { error: finishRoundError } = await auth.supabase
      .from("cwl_rounds")
      .update({
        status: "processed",
        processed_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", roundId);

    if (finishRoundError) throw finishRoundError;

    return NextResponse.json({
      success: true,
      roundNumber: round.round_number,
      playersProcessed: performanceRows.length,
      completeCount,
      pendingCount,
      protectedCount,
      message:
        pendingCount > 0
          ? "Processamento concluÃdo com jogadores aguardando dados de ataque ou defesa."
          : "Desempenho da rodada processado com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao processar desempenho CWL:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erro inesperado.";

    // Registra a falha da execuÃ§Ã£o.
    if (processingRunId) {
      const { error: runUpdateError } = await auth.supabase
        .from("cwl_processing_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq("id", processingRunId);

      if (runUpdateError) {
        console.error(
          "Erro ao atualizar execuÃ§Ã£o CWL:",
          runUpdateError
        );
      }
    }

    // SÃ³ altera o status da rodada se uma execuÃ§Ã£o chegou a ser iniciada.
    if (processingRunId && roundId) {
      const { error: roundUpdateError } = await auth.supabase
        .from("cwl_rounds")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", roundId);

      if (roundUpdateError) {
        console.error(
          "Erro ao atualizar status da rodada:",
          roundUpdateError
        );
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}