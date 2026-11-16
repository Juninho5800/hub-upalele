import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeTag } from "@/lib/clash/strategy";
import {
  getCwlGroup,
  getCwlWar,
  orientCwlWar,
  parseCwlDate,
} from "@/lib/cwl/clash-api";

export const dynamic = "force-dynamic";

function mapWarStatus(state: string) {
  switch (state) {
    case "preparation":
      return "preparation";
    case "inWar":
      return "in_war";
    case "warEnded":
      return "ended";
    default:
      return "unknown";
  }
}

function mapRoundStatus(state: string) {
  switch (state) {
    case "preparation":
      return "scheduled";
    case "inWar":
      return "in_progress";
    case "warEnded":
      return "completed";
    default:
      return "scheduled";
  }
}

type RoundResult = {
  status: string;
  warId: string | null;
};

function validTag(tag: unknown): tag is string {
  return typeof tag === "string" && normalizeTag(tag).length > 0;
}

function validAttack(
  attack: {
    attackerTag?: string;
    defenderTag?: string;
    stars?: number;
    destructionPercentage?: number;
    order?: number;
  },
  attackerTag: string
) {
  return (
    validTag(attack.attackerTag) &&
    normalizeTag(attack.attackerTag) === normalizeTag(attackerTag) &&
    validTag(attack.defenderTag) &&
    Number.isInteger(attack.stars) &&
    (attack.stars ?? -1) >= 0 &&
    (attack.stars ?? 4) <= 3 &&
    typeof attack.destructionPercentage === "number" &&
    Number.isFinite(attack.destructionPercentage) &&
    attack.destructionPercentage >= 0 &&
    attack.destructionPercentage <= 100 &&
    Number.isInteger(attack.order) &&
    (attack.order ?? 0) >= 1
  );
}

export async function POST() {
  try {
    const supabase = await createClient();

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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Erro ao validar perfil CWL:", profileError);
      return NextResponse.json(
        { error: "Não foi possível validar suas permissões." },
        { status: 500 }
      );
    }

    if (
      profile?.is_active !== true ||
      !["leader", "co_leader"].includes(profile.role ?? "")
    ) {
      return NextResponse.json(
        { error: "Sem permissão para sincronizar a CWL." },
        { status: 403 }
      );
    }

    const clanTag = process.env.CLASH_OF_CLANS_CLAN_TAG;
    const apiToken = process.env.CLASH_OF_CLANS_API_TOKEN;

    if (!clanTag || !apiToken) {
      return NextResponse.json(
        { error: "Configuração da API do Clash of Clans ausente." },
        { status: 500 }
      );
    }

    const expectedTag = normalizeTag(clanTag);
    if (!expectedTag) {
      return NextResponse.json(
        { error: "A tag do clã configurada é inválida." },
        { status: 500 }
      );
    }

    const group = await getCwlGroup(clanTag);

    if (!group.season || !Array.isArray(group.rounds)) {
      return NextResponse.json(
        { error: "A API retornou dados inválidos da liga." },
        { status: 502 }
      );
    }

    if (group.rounds.length !== 7) {
      return NextResponse.json(
        {
          error: `A API retornou ${group.rounds.length} rodadas. Esperávamos 7.`,
        },
        { status: 502 }
      );
    }

    const seasonMonth = /^\d{4}-\d{2}/.test(group.season)
      ? `${group.season.slice(0, 7)}-01`
      : null;

    const { data: season, error: seasonError } = await supabase
      .from("cwl_seasons")
      .upsert(
        {
          season: group.season,
          selection_month: seasonMonth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "season" }
      )
      .select("id,status")
      .single();

    if (seasonError || !season) {
      console.error("Erro ao salvar temporada CWL:", seasonError);
      return NextResponse.json(
        { error: "Não foi possível salvar a temporada da CWL." },
        { status: 500 }
      );
    }

    const summary = {
      season: group.season,
      roundsFound: 0,
      warsSaved: 0,
      attacksSaved: 0,
      participantsSaved: 0,
      warnings: [] as string[],
    };

    const roundResults: RoundResult[] = [];

    for (let index = 0; index < 7; index++) {
      const round = group.rounds[index];
      const warTags = [
        ...new Set(
          (round?.warTags ?? [])
            .filter((tag) => validTag(tag) && normalizeTag(tag) !== "0")
            .map((tag) => tag.trim())
        ),
      ];

      let selectedWar:
        | {
            tag: string;
            war: Awaited<ReturnType<typeof getCwlWar>>;
          }
        | null = null;

      let hadLookupError = false;

      for (const warTag of warTags) {
        try {
          const candidate = await getCwlWar(warTag);

          const candidateClanTag = candidate?.clan?.tag;
          const candidateOpponentTag = candidate?.opponent?.tag;

          if (!validTag(candidateClanTag) || !validTag(candidateOpponentTag)) {
            hadLookupError = true;
            continue;
          }

          const belongsToClan =
            normalizeTag(candidateClanTag) === expectedTag ||
            normalizeTag(candidateOpponentTag) === expectedTag;

          if (belongsToClan) {
            selectedWar = {
              tag: warTag,
              war: orientCwlWar(candidate, clanTag),
            };
            break;
          }
        } catch (error) {
          hadLookupError = true;
          console.error(
            `Erro ao consultar guerra da rodada ${index + 1}:`,
            error
          );
        }
      }

      if (!selectedWar) {
        if (hadLookupError && warTags.length > 0) {
          summary.warnings.push(
            `Rodada ${index + 1}: não foi possível consultar todas as guerras disponíveis. Os dados anteriores foram preservados.`
          );
          roundResults.push({ status: "unknown", warId: null });
          continue;
        }

        // Não apaga uma guerra previamente vinculada apenas porque a API
        // ainda não retornou warTags para esta rodada.
        const { data: existingRound, error: existingRoundError } =
          await supabase
            .from("cwl_rounds")
            .select("id,war_id,status")
            .eq("season_id", season.id)
            .eq("round_number", index + 1)
            .maybeSingle();

        if (existingRoundError) {
          summary.warnings.push(
            `Rodada ${index + 1}: não foi possível consultar o registro existente: ${existingRoundError.message}`
          );
          roundResults.push({ status: "unknown", warId: null });
          continue;
        }

        if (existingRound?.war_id) {
          roundResults.push({
            status: existingRound.status,
            warId: existingRound.war_id,
          });
          continue;
        }

        const { error: roundError } = await supabase
          .from("cwl_rounds")
          .upsert(
            {
              season_id: season.id,
              round_number: index + 1,
              war_id: null,
              status: "scheduled",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "season_id,round_number" }
          );

        if (roundError) {
          summary.warnings.push(
            `Rodada ${index + 1}: ${roundError.message}`
          );
          roundResults.push({ status: "unknown", warId: null });
          continue;
        }

        roundResults.push({ status: "scheduled", warId: null });
        continue;
      }

      const { tag, war } = selectedWar;

      if (
        !war.clan?.tag ||
        normalizeTag(war.clan.tag) !== expectedTag ||
        !war.opponent?.tag ||
        !Array.isArray(war.clan.members) ||
        !Array.isArray(war.opponent.members)
      ) {
        summary.warnings.push(
          `Rodada ${index + 1}: a guerra retornada não está orientada corretamente ou possui dados incompletos.`
        );
        roundResults.push({ status: "unknown", warId: null });
        continue;
      }

      const warStatus = mapWarStatus(war.state);
      const apiRoundStatus = mapRoundStatus(war.state);
      const externalWarTag = `CWL:${normalizeTag(tag)}`;

      const { data: savedWar, error: warError } = await supabase
        .from("wars")
        .upsert(
          {
            external_war_tag: externalWarTag,
            war_type: "cwl",
            status: warStatus,
            preparation_start: parseCwlDate(war.preparationStartTime),
            war_start: parseCwlDate(war.startTime),
            war_end: parseCwlDate(war.endTime),
            team_size: war.teamSize ?? war.clan.members.length,
            clan_stars: war.clan.stars ?? 0,
            opponent_stars: war.opponent.stars ?? 0,
            raw_payload: war,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "external_war_tag" }
        )
        .select("id")
        .single();

      if (warError || !savedWar) {
        console.error(`Erro ao salvar guerra da rodada ${index + 1}:`, warError);
        summary.warnings.push(
          `Rodada ${index + 1}: não foi possível salvar a guerra.`
        );
        roundResults.push({ status: "unknown", warId: null });
        continue;
      }

      // Preserva estados locais de processamento já concluído ou em andamento.
      const { data: existingRound, error: existingRoundError } =
        await supabase
          .from("cwl_rounds")
          .select("id,status")
          .eq("season_id", season.id)
          .eq("round_number", index + 1)
          .maybeSingle();

      if (existingRoundError) {
        summary.warnings.push(
          `Rodada ${index + 1}: guerra salva, mas não foi possível consultar o estado local da rodada: ${existingRoundError.message}`
        );
        roundResults.push({ status: "unknown", warId: savedWar.id });
        continue;
      }

      const protectedLocalStatuses = [
        "processing",
        "processed",
        "failed",
      ];

      const roundStatus = protectedLocalStatuses.includes(
        existingRound?.status ?? ""
      )
        ? existingRound!.status
        : apiRoundStatus;

      const { error: roundError } = await supabase
        .from("cwl_rounds")
        .upsert(
          {
            season_id: season.id,
            round_number: index + 1,
            war_id: savedWar.id,
            status: roundStatus,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "season_id,round_number" }
        );

      if (roundError) {
        summary.warnings.push(
          `Rodada ${index + 1}: erro ao vincular guerra: ${roundError.message}`
        );
        roundResults.push({ status: "unknown", warId: null });
        continue;
      }

      summary.roundsFound++;
      summary.warsSaved++;
      roundResults.push({ status: roundStatus, warId: savedWar.id });

      const clanMembers = war.clan.members;
      const opponentMembers = war.opponent.members;

      const clanTags = new Set(
        clanMembers
          .map((member) => member.tag)
          .filter((memberTag): memberTag is string => validTag(memberTag))
          .map(normalizeTag)
      );

      const opponentTags = new Set(
        opponentMembers
          .map((member) => member.tag)
          .filter((memberTag): memberTag is string => validTag(memberTag))
          .map(normalizeTag)
      );

      if (
        clanMembers.length === 0 ||
        opponentMembers.length === 0 ||
        clanTags.size !== clanMembers.length ||
        opponentTags.size !== opponentMembers.length
      ) {
        summary.warnings.push(
          `Rodada ${index + 1}: lista de membros vazia, com tags ausentes ou duplicadas. Participantes e ataques desta rodada não foram atualizados.`
        );
        continue;
      }

      const participants = clanMembers.map((member) => ({
        season_id: season.id,
        player_tag: member.tag,
        player_name: member.name,
        town_hall_level: member.townhallLevel ?? null,
      }));

      const { error: participantError } = await supabase
        .from("cwl_participants")
        .upsert(participants, {
          onConflict: "season_id,player_tag",
        });

      if (participantError) {
        console.error(
          `Erro ao salvar participantes da rodada ${index + 1}:`,
          participantError
        );
        summary.warnings.push(
          `Rodada ${index + 1}: erro ao salvar participantes.`
        );
      } else {
        summary.participantsSaved += participants.length;
      }

      const allMembers = [
        ...clanMembers.map((member) => ({
          member,
          sideMembers: opponentMembers,
        })),
        ...opponentMembers.map((member) => ({
          member,
          sideMembers: clanMembers,
        })),
      ];

      const attacks: {
        war_id: string;
        attacker_tag: string;
        attacker_name: string;
        defender_tag: string;
        defender_name: string | null;
        attacker_map_position: number | null;
        defender_map_position: number | null;
        stars: number;
        destruction_percent: number;
        attack_order: number;
        external_attack_key: string;
        raw_payload: unknown;
      }[] = [];

      let invalidAttackFound = false;
      const attackKeys = new Set<string>();

      for (const { member, sideMembers } of allMembers) {
        for (const attack of member.attacks ?? []) {
          const attackerTag = attack.attackerTag || member.tag;

          if (
            !validTag(member.tag) ||
            !validAttack(attack, attackerTag) ||
            normalizeTag(attackerTag) !== normalizeTag(member.tag)
          ) {
            invalidAttackFound = true;
            continue;
          }

          const defender = sideMembers.find(
            (item) =>
              validTag(item.tag) &&
              normalizeTag(item.tag) === normalizeTag(attack.defenderTag!)
          );

          if (!defender) {
            invalidAttackFound = true;
            continue;
          }

          const externalAttackKey = `${normalizeTag(attackerTag)}:${attack.order}`;

          if (attackKeys.has(externalAttackKey)) {
            invalidAttackFound = true;
            continue;
          }

          attackKeys.add(externalAttackKey);
          attacks.push({
            war_id: savedWar.id,
            attacker_tag: attackerTag,
            attacker_name: member.name,
            defender_tag: attack.defenderTag!,
            defender_name: defender.name ?? null,
            attacker_map_position: member.mapPosition ?? null,
            defender_map_position: defender.mapPosition ?? null,
            stars: attack.stars!,
            destruction_percent: attack.destructionPercentage!,
            attack_order: attack.order!,
            external_attack_key: externalAttackKey,
            raw_payload: attack,
          });
        }
      }

      if (invalidAttackFound) {
        summary.warnings.push(
          `Rodada ${index + 1}: foram encontrados ataques inválidos ou duplicados. Os ataques desta rodada não foram gravados.`
        );
        continue;
      }

      if (attacks.length > 0) {
        const { error: attacksError } = await supabase
          .from("war_attacks")
          .upsert(attacks, {
            onConflict: "war_id,external_attack_key",
          });

        if (attacksError) {
          console.error(
            `Erro ao salvar ataques da rodada ${index + 1}:`,
            attacksError
          );
          summary.warnings.push(
            `Rodada ${index + 1}: erro ao salvar ataques.`
          );
        } else {
          summary.attacksSaved += attacks.length;
        }
      }
    }

    const allRoundsCompleted =
      roundResults.length === 7 &&
      roundResults.every(
        (round) =>
          round.status === "completed" || round.status === "processed"
      );

    const anyRoundStarted = roundResults.some((round) =>
      ["in_progress", "completed", "processing", "processed", "failed"].includes(
        round.status
      )
    );

    const hasIncompleteRounds =
      roundResults.length !== 7 ||
      roundResults.some((round) => round.status === "unknown");

    const currentSeasonStatus = season.status;
    const seasonStatus =
      currentSeasonStatus === "cancelled" ||
      currentSeasonStatus === "completed"
        ? currentSeasonStatus
        : allRoundsCompleted && !hasIncompleteRounds
          ? "completed"
          : anyRoundStarted
            ? "active"
            : currentSeasonStatus;

    const { error: updateSeasonError } = await supabase
      .from("cwl_seasons")
      .update({
        status: seasonStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", season.id);

    if (updateSeasonError) {
      summary.warnings.push(
        `Temporada: erro ao atualizar status: ${updateSeasonError.message}`
      );
    }

    return NextResponse.json({
      success: true,
      ...summary,
      seasonStatus,
      hasWarnings: summary.warnings.length > 0,
    });
  } catch (error) {
    console.error("Erro na sincronização CWL:", error);

    if (
      error instanceof Error &&
      error.message.includes("Clash API retornou 404")
    ) {
      return NextResponse.json({
        success: true,
        available: false,
        message:
          "Não existe uma CWL disponível para sincronização no momento. Aguarde a próxima temporada.",
      });
    }

    return NextResponse.json(
      { error: "Erro inesperado ao sincronizar a CWL." },
      { status: 500 }
    );
  }
}
