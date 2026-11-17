import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getTarget,
  normalizeTag,
  type StrategyMember,
} from "@/lib/clash/strategy";
export const dynamic = "force-dynamic";
type WarAttack = {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  destructionPercentage: number;
  order: number;
};
type WarMember = StrategyMember & {
  attacks?: WarAttack[];
};
type WarSide = {
  tag: string;
  name: string;
  stars?: number;
  destructionPercentage?: number;
  members?: WarMember[];
};
type ClashWar = {
  state: string;
  teamSize?: number;
  attacksPerMember?: number;
  preparationStartTime?: string;
  startTime?: string;
  endTime?: string;
  clan: WarSide;
  opponent: WarSide;
};
function parseClashDate(value?: string | null): string | null {
  if (!value) return null;
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d+))?Z$/
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s, ms = "0"] = match;
  return new Date(
    Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
      Number((ms + "000").slice(0, 3))
    )
  ).toISOString();
}
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: "Você precisa estar autenticado." },
      { status: 401 }
    );
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json(
      { error: "Não foi possível verificar o perfil." },
      { status: 500 }
    );
  }
  const canSync =
    profile?.is_active === true &&
    (profile.role === "leader" || profile.role === "co_leader");

  if (!canSync) {
    return NextResponse.json(
      { error: "Somente a liderança ativa pode sincronizar guerras." },
      { status: 403 }
    );
  }
  const token = process.env.CLASH_OF_CLANS_API_TOKEN;
  const clanTag = process.env.CLASH_OF_CLANS_CLAN_TAG;
  if (!token || !clanTag) {
    return NextResponse.json(
      { error: "Configure o token e a tag nas variáveis de ambiente." },
      { status: 500 }
    );
  }
  try {
    const normalizedClanTag = normalizeTag(clanTag);
    const encodedTag = encodeURIComponent(`#${normalizedClanTag}`);
    const response = await fetch(
      `https://cocproxy.royaleapi.dev/v1/clans/${encodedTag}/currentwar`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    if (response.status === 404) {
      return NextResponse.json({
        success: true,
        inWar: false,
        message:
          "A API não disponibilizou uma guerra atual. Nenhuma guerra foi alterada.",
      });
    }
    if (!response.ok) {
      const details = await response.text();
      console.error("[Clash API] sync:", {
        status: response.status,
        details,
      });
      return NextResponse.json(
        {
          error: "Falha ao consultar a API do Clash of Clans.",
          status: response.status,
          details,
        },
        { status: response.status }
      );
    }
    const war = (await response.json()) as ClashWar;

    if (
      !war.clan?.tag ||
      normalizeTag(war.clan.tag) !== normalizedClanTag
    ) {
      return NextResponse.json(
        {
          error: "A guerra retornada pela API não pertence ao clã configurado.",
        },
        { status: 502 }
      );
    }

    const warLogResponse = await fetch(
  `https://cocproxy.royaleapi.dev/v1/clans/${encodedTag}/warlog?limit=10`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  }
);
let warLogData = null;
if (warLogResponse.ok) {
  warLogData = await warLogResponse.json();
} else {
  console.error(
    "[Clash WarLog]",
    warLogResponse.status,
    await warLogResponse.text()
  );
}
type WarLogEntry = {
  result: "win" | "lose" | "tie";
  endTime: string;
  teamSize?: number;
  clan: {
    tag: string;
    stars: number;
  };
  opponent: {
    tag: string;
    name: string;
    stars: number;
  };
};
let historicalWarsUpdated = 0;
let historicalWarErrors = 0;
if (warLogResponse.ok && warLogData?.items?.length) {
  const entries = warLogData.items as WarLogEntry[];
  const { data: knownWars, error: knownWarsError } =
    await supabase
      .from("wars")
      .select("id, status, war_end, raw_payload")
      .limit(50);
  if (knownWarsError) {
    console.error(
      "[WarLog] Erro ao consultar guerras existentes:",
      knownWarsError.message
    );
  } else {
    for (const entry of entries) {
      const historicalEnd = parseClashDate(entry.endTime);
      if (!historicalEnd) continue;
      if (
  !entry?.opponent?.tag ||
  !entry?.clan?.tag ||
  !entry?.endTime
) {
  console.warn("[WarLog] Registro ignorado por dados incompletos:", entry);
  continue;
}
const opponentTag = normalizeTag(entry.opponent.tag);
      const matchingWars = (knownWars ?? []).filter((saved) => {
        const payload = saved.raw_payload as {
          opponent?: { tag?: string };
        } | null;
        const savedOpponentTag = payload?.opponent?.tag;
        if (!savedOpponentTag || !saved.war_end) return false;
        const sameOpponent =
          normalizeTag(savedOpponentTag) === opponentTag;
        const timeDifference = Math.abs(
          new Date(saved.war_end).getTime() -
          new Date(historicalEnd).getTime()
        );
        return sameOpponent &&
          timeDifference <= 24 * 60 * 60 * 1000;
      });
      if (matchingWars.length !== 1) continue;
      const { error: updateError } = await supabase
        .from("wars")
        .update({
          status: "ended",
          war_end: historicalEnd,
          clan_stars: entry.clan.stars,
          opponent_stars: entry.opponent.stars,
          team_size: entry.teamSize ?? null,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", matchingWars[0].id);
      if (updateError) {
        historicalWarErrors++;
        console.error(
          "[WarLog] Erro ao atualizar guerra:",
          updateError.message
        );
      } else {
        historicalWarsUpdated++;
      }
    }
  }
}
    if (!war.clan || !war.opponent || !war.preparationStartTime) {
      return NextResponse.json(
        { error: "A API retornou dados incompletos da guerra." },
        { status: 502 }
      );
    }
    const preparationStart = parseClashDate(
      war.preparationStartTime
    );
    const warStart = parseClashDate(war.startTime);
    const warEnd = parseClashDate(war.endTime);
    if (!preparationStart) {
      return NextResponse.json(
        { error: "Data de preparação inválida na resposta da API." },
        { status: 502 }
      );
    }
    const externalWarTag =
      `${normalizeTag(war.clan.tag)}:` +
      `${normalizeTag(war.opponent.tag)}:` +
      `${war.preparationStartTime}`;
    const status =
      war.state === "preparation"
        ? "preparation"
        : war.state === "inWar"
          ? "in_war"
          : war.state === "warEnded"
            ? "ended"
            : "unknown";
    const { data: savedWar, error: warError } = await supabase
      .from("wars")
      .upsert(
        {
          external_war_tag: externalWarTag,
          status,
          war_type: "clan_war",
          preparation_start: preparationStart,
          war_start: warStart,
          war_end: warEnd,
          team_size: war.teamSize ?? null,
          clan_stars: war.clan.stars ?? 0,
          opponent_stars: war.opponent.stars ?? 0,
          raw_payload: war,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "external_war_tag" }
      )
      .select("id")
      .single();
    if (warError || !savedWar) {
      return NextResponse.json(
        {
          error: "Não foi possível salvar a guerra.",
          details: warError?.message,
        },
        { status: 500 }
      );
    }
    const clanMembers: WarMember[] = Array.isArray(war.clan.members)
      ? war.clan.members
      : [];
    const opponentMembers: WarMember[] = Array.isArray(
      war.opponent.members
    )
      ? war.opponent.members
      : [];
    const clanByTag = new Map(
      clanMembers.map((member) => [
        normalizeTag(member.tag),
        member,
      ])
    );
    const opponentByTag = new Map(
      opponentMembers.map((member) => [
        normalizeTag(member.tag),
        member,
      ])
    );
    
// Jogadores isentos de ocorrência por desvio de alvo.
const EXEMPT_PLAYER_TAGS = new Set([
  "#L82PUQGJL",
  "#P0CLYPGUJ",
  "#YLLC8C8YU",
  "#LJY90LQG",
  "#G8V9CLC9",
].map(normalizeTag));

    // Salva os ataques dos dois lados da guerra.
    const attacks: Record<string, unknown>[] = [];
    for (const member of clanMembers) {
      for (const attack of member.attacks ?? []) {
        if (!attack.attackerTag || !attack.defenderTag) {
          continue;
        }
        const attacker =
          clanByTag.get(normalizeTag(attack.attackerTag)) ?? member;
        const defender = opponentByTag.get(
          normalizeTag(attack.defenderTag)
        );
        attacks.push({
          war_id: savedWar.id,
          attacker_tag: attack.attackerTag,
          attacker_name: attacker.name,
          defender_tag: attack.defenderTag,
          defender_name: defender?.name ?? null,
          attacker_map_position: attacker.mapPosition ?? null,
          defender_map_position: defender?.mapPosition ?? null,
          stars: attack.stars ?? 0,
          destruction_percent:
            attack.destructionPercentage ?? 0,
          attack_order: attack.order ?? null,
          external_attack_key:
            `${normalizeTag(attack.attackerTag)}:${attack.order}`,
          raw_payload: attack,
        });
      }
    }
    for (const member of opponentMembers) {
      for (const attack of member.attacks ?? []) {
        if (!attack.attackerTag || !attack.defenderTag) {
          continue;
        }
        const attacker =
          opponentByTag.get(normalizeTag(attack.attackerTag)) ??
          member;
        const defender = clanByTag.get(
          normalizeTag(attack.defenderTag)
        );
        attacks.push({
          war_id: savedWar.id,
          attacker_tag: attack.attackerTag,
          attacker_name: attacker.name,
          defender_tag: attack.defenderTag,
          defender_name: defender?.name ?? null,
          attacker_map_position: attacker.mapPosition ?? null,
          defender_map_position: defender?.mapPosition ?? null,
          stars: attack.stars ?? 0,
          destruction_percent:
            attack.destructionPercentage ?? 0,
          attack_order: attack.order ?? null,
          external_attack_key:
            `${normalizeTag(attack.attackerTag)}:${attack.order}`,
          raw_payload: attack,
        });
      }
    }
    if (attacks.length > 0) {
      const { error: attacksError } = await supabase
        .from("war_attacks")
        .upsert(attacks, {
          onConflict: "war_id,external_attack_key",
        });
      if (attacksError) {
        return NextResponse.json(
          {
            error:
              "A guerra foi salva, mas houve falha ao salvar os ataques.",
            details: attacksError.message,
            warId: savedWar.id,
          },
          { status: 500 }
        );
      }
    }
    // Detecção automática dos desvios estratégicos.
    // A ordem global permite reconstruir o mapa antes de cada ataque.
    const orderedAttacks = clanMembers
      .flatMap((member) =>
        (member.attacks ?? []).map((attack) => ({
          member,
          attack,
          attackerTag: normalizeTag(
            attack.attackerTag || member.tag
          ),
          defenderTag: normalizeTag(attack.defenderTag),
        }))
      )
      .filter(
        (item) =>
          item.attackerTag &&
          item.defenderTag &&
          Number.isFinite(item.attack.order)
      )
      .sort((a, b) => a.attack.order - b.attack.order);
      const bestStarsByEnemy = new Map<string, number>();
const attacksByPlayer = new Map<string, number>();
const attackedEnemiesByPlayer = new Map<string, Set<string>>();
    let occurrencesCreated = 0;
    let occurrenceErrors = 0;
    let attacksAnalyzed = 0;
    let votesCreated = 0;
    let voteErrors = 0;
    const votingOptions = [
      "Advertência",
      "Gancho 1 guerra",
      "Gancho 2 guerras",
      "Gancho 3 guerras",
      "Gancho 5 guerras",
      "Gancho 7 dias",
      "Gancho 14 dias",
      "Gancho 30 dias",
      "Kick definitivo",
      "Outra punição",
      "Não aplicar punição",
    ];
    for (const item of orderedAttacks) {
      const { member, attack, attackerTag, defenderTag } = item;
      const attacker = clanByTag.get(attackerTag) ?? member;
      const defender = opponentByTag.get(defenderTag);
      // A ordem é global; contamos separadamente os ataques de cada jogador.
      const attackNumber =
        (attacksByPlayer.get(attackerTag) ?? 0) + 1;
      attacksByPlayer.set(attackerTag, attackNumber);
      attacksAnalyzed++;
      if (!defender) continue;
      if (attackNumber <= 2) {
        // A estratégia recebe somente as estrelas dos ataques anteriores.
        const alreadyAttacked =
  attackedEnemiesByPlayer.get(attackerTag) ?? new Set<string>();
const strategy = getTarget(
  attackNumber === 1 ? "1" : "2",
  attacker,
  opponentMembers,
  bestStarsByEnemy,
  alreadyAttacked
);
        const expectedTarget = strategy.target;
        if (
  expectedTarget &&
  normalizeTag(expectedTarget.tag) !== defenderTag &&
  strategy.ruleReference &&
  !EXEMPT_PLAYER_TAGS.has(attackerTag)
) {
          const attackLabel =
            attackNumber === 1 ? "1º ataque" : "2º ataque";
          const externalAttackKey =
            `${attackNumber === 1 ? "first" : "second"}:` +
            `${savedWar.id}:${attackerTag}:${attack.order}`;
          const ruleReference = strategy.ruleReference;
          const description =
            `ERRO DE ESTRATÉGIA — ${attackLabel}\n\n` +
            `Jogador: ${attacker.name} (#${attacker.mapPosition}).\n` +
            `Alvo atacado: ${defender.name} (#${defender.mapPosition}).\n` +
            `Alvo esperado: ${expectedTarget.name} (#${expectedTarget.mapPosition}).\n` +
            `Motivo: ${strategy.reason}\n` +
            `Referência: ${ruleReference} do memorial.\n\n` +
            `Ocorrência detectada automaticamente pelo HUB. ` +
            `A liderança deve conferir o mapa e analisar o caso antes de decidir.`;
          const {
            data: inserted,
            error: occurrenceError,
          } = await supabase
            .from("war_occurrences")
            .upsert(
              {
                war_id: savedWar.id,
                external_attack_key: externalAttackKey,
                attack_order: attack.order,
                player_position: attacker.mapPosition,
                title: `Erro de estratégia — ${attackLabel}`,
                occurrence_type: "strategy_error",
                status: "pending",
                player_name: attacker.name,
                player_tag: attacker.tag,
                attack_number: attackNumber,
                attacked_target_name: defender.name,
                attacked_target_tag: defender.tag,
                attacked_target_position: defender.mapPosition,
                expected_target_name: expectedTarget.name,
                expected_target_tag: expectedTarget.tag,
                expected_target_position: expectedTarget.mapPosition,
                rule_reference: ruleReference,
                description,
                created_by: user.id,
              },
              {
                onConflict: "external_attack_key",
                ignoreDuplicates: true,
              }
            )
            .select("id");
          if (occurrenceError) {
            occurrenceErrors++;
            console.error(
              "[Occurrences] Erro ao registrar ocorrência:",
              occurrenceError.message
            );
          } else {
            if (inserted && inserted.length > 0) {
              occurrencesCreated++;
            }
            // Recupera também ocorrências antigas, quando o upsert ignora duplicatas.
            const {
              data: occurrence,
              error: findOccurrenceError,
            } = await supabase
              .from("war_occurrences")
              .select("id")
              .eq("external_attack_key", externalAttackKey)
              .maybeSingle();
            if (findOccurrenceError || !occurrence) {
              voteErrors++;
              console.error(
                "[Votes] Não foi possível localizar a ocorrência:",
                findOccurrenceError?.message
              );
            } else {
              // Uma ocorrência só pode ter uma votação vinculada.
              let { data: linkedVote, error: findVoteError } =
                await supabase
                  .from("leadership_votes")
                  .select("id")
                  .eq("occurrence_id", occurrence.id)
                  .maybeSingle();
              if (findVoteError) {
                voteErrors++;
                console.error(
                  "[Votes] Erro ao consultar votação:",
                  findVoteError.message
                );
              } else {
                if (!linkedVote) {
                  const {
                    data: newVote,
                    error: createVoteError,
                  } = await supabase
                    .from("leadership_votes")
                    .insert({
                      occurrence_id: occurrence.id,
                      title: `Votação de punição — ${attacker.name} (${attackLabel})`,
                      description:
                        `${description}\n\n` +
                        "Analise o memorial e as informações da ocorrência antes de votar.",
                      category: "Punição",
                      status: "open",
                      created_by: user.id,
                      deadline: new Date(
                        Date.now() + 24 * 60 * 60 * 1000
                      ).toISOString(),
                      punishment_member_name: attacker.name,
                      punishment_player_tag: attacker.tag,
                      punishment_label: "A definir pela votação",
                      punishment_duration_wars: null,
                      punishment_reason: description,
                    })
                    .select("id")
                    .single();
                  if (createVoteError) {
                    // Em caso de sincronizações simultâneas, recupera a votação criada pela outra requisição.
                    const {
                      data: existingVote,
                      error: retryFindError,
                    } = await supabase
                      .from("leadership_votes")
                      .select("id")
                      .eq("occurrence_id", occurrence.id)
                      .maybeSingle();
                    if (retryFindError || !existingVote) {
                      voteErrors++;
                      console.error(
                        "[Votes] Erro ao criar votação:",
                        createVoteError.message
                      );
                    } else {
                      linkedVote = existingVote;
                    }
                  } else if (newVote) {
                    linkedVote = newVote;
                    votesCreated++;
                  }
                }
                // Garante que a votação tenha opções.
                if (linkedVote) {
                  // Correção: constante não nula para uso dentro do map.
                  const voteId = linkedVote.id;
                  const optionsToEnsure = votingOptions.map(
                    (label, index) => ({
                      vote_id: voteId,
                      label,
                      sort_order: index + 1,
                    })
                  );
                  // Insere somente opções ausentes; preserva as existentes.
                  // A chave única (vote_id, label) evita duplicações em sincronizações simultâneas.
                  const { error: insertOptionsError } = await supabase
                    .from("leadership_vote_options")
                    .upsert(optionsToEnsure, {
                      onConflict: "vote_id,label",
                      ignoreDuplicates: true,
                    });
                  if (insertOptionsError) {
                    voteErrors++;
                    console.error(
                      "[Votes] Erro ao garantir opções da votação:",
                      insertOptionsError.message
                    );
                  }
                }
              }
            }
          }
        }
      }
      // O ataque atual só altera as estrelas disponíveis após sua avaliação.
      const previousStars =
  bestStarsByEnemy.get(defenderTag) ?? 0;
bestStarsByEnemy.set(
  defenderTag,
  Math.max(previousStars, attack.stars ?? 0)
);
// Registra que este jogador já atacou esse inimigo.
const playerAttackedTargets =
  attackedEnemiesByPlayer.get(attackerTag) ?? new Set<string>();
playerAttackedTargets.add(defenderTag);
attackedEnemiesByPlayer.set(
  attackerTag,
  playerAttackedTargets
);
    }
    // Registra ataques não realizados somente depois do encerramento da guerra.
    // Na guerra normal, cada jogador tem direito a dois ataques.
    if (war.state === "warEnded") {
      const requiredAttacks = 2;
      for (const member of clanMembers) {
        const playerTag = normalizeTag(member.tag);
        if (!playerTag) continue;
        const performedAttacks = (member.attacks ?? []).filter(
          (attack) =>
            Boolean(attack.attackerTag) &&
            normalizeTag(attack.attackerTag) === playerTag
        );
        const performedCount = Math.min(
          performedAttacks.length,
          requiredAttacks
        );
        const missingCount = requiredAttacks - performedCount;
        if (missingCount <= 0) continue;
        const missingAttackNumber = performedCount + 1;
        const externalAttackKey =
          `missed:${savedWar.id}:${playerTag}`;
        const playerName = member.name || `Jogador ${member.tag}`;
        const missingLabel =
          missingCount === 1 ? "1 ataque não realizado" : "2 ataques não realizados";
        const description =
          `ATAQUE NÃO REALIZADO\n\n` +
          `Jogador: ${playerName}.\n` +
          `Ataques realizados: ${performedCount} de ${requiredAttacks}.\n` +
          `Ataques não realizados: ${missingCount}.\n\n` +
          `A ocorrência foi registrada automaticamente após o encerramento da guerra. ` +
          `A liderança deve analisar o caso antes de decidir qualquer punição.`;
        const {
          data: insertedMissedOccurrence,
          error: missedOccurrenceError,
        } = await supabase
          .from("war_occurrences")
          .upsert(
            {
              war_id: savedWar.id,
              external_attack_key: externalAttackKey,
              attack_order: null,
              player_position: member.mapPosition ?? null,
              title: `Ataque não realizado — ${missingCount}`,
              occurrence_type: "missed_attack",
              status: "pending",
              player_name: playerName,
              player_tag: member.tag,
              attack_number: missingAttackNumber,
              description,
              created_by: user.id,
            },
            {
              onConflict: "external_attack_key",
              ignoreDuplicates: true,
            }
          )
          .select("id");
        if (missedOccurrenceError) {
          occurrenceErrors++;
          console.error(
            "[Occurrences] Erro ao registrar ataque não realizado:",
            missedOccurrenceError.message
          );
          continue;
        }
        if (insertedMissedOccurrence?.length) {
          occurrencesCreated++;
        }
        // Recupera a ocorrência também quando ela já existia, evitando duplicidade.
        const { data: missedOccurrence, error: findMissedOccurrenceError } =
          await supabase
            .from("war_occurrences")
            .select("id")
            .eq("external_attack_key", externalAttackKey)
            .maybeSingle();
        if (findMissedOccurrenceError || !missedOccurrence) {
          voteErrors++;
          console.error(
            "[Votes] Não foi possível localizar a ocorrência de ataque não realizado:",
            findMissedOccurrenceError?.message
          );
          continue;
        }
        const { data: existingMissedVote, error: findMissedVoteError } =
          await supabase
            .from("leadership_votes")
            .select("id")
            .eq("occurrence_id", missedOccurrence.id)
            .maybeSingle();
        if (findMissedVoteError) {
          voteErrors++;
          console.error(
            "[Votes] Erro ao consultar votação de ataque não realizado:",
            findMissedVoteError.message
          );
          continue;
        }
        let missedVote = existingMissedVote;
        if (!missedVote) {
          const { data: createdMissedVote, error: createMissedVoteError } =
            await supabase
              .from("leadership_votes")
              .insert({
                occurrence_id: missedOccurrence.id,
                title: `Votação de punição — ${playerName} (${missingLabel})`,
                description:
                  `${description}\n\n` +
                  "Analise o memorial e as informações da ocorrência antes de votar.",
                category: "Punição",
                status: "open",
                created_by: user.id,
                deadline: new Date(
                  Date.now() + 24 * 60 * 60 * 1000
                ).toISOString(),
                punishment_member_name: playerName,
                punishment_player_tag: member.tag,
                punishment_label: "A definir pela votação",
                punishment_duration_wars: null,
                punishment_reason: description,
              })
              .select("id")
              .single();
          if (createMissedVoteError || !createdMissedVote) {
            // Recupera uma votação criada por outra sincronização simultânea.
            const { data: retryMissedVote, error: retryMissedVoteError } =
              await supabase
                .from("leadership_votes")
                .select("id")
                .eq("occurrence_id", missedOccurrence.id)
                .maybeSingle();
            if (retryMissedVoteError || !retryMissedVote) {
              voteErrors++;
              console.error(
                "[Votes] Erro ao criar votação de ataque não realizado:",
                createMissedVoteError?.message
              );
              continue;
            }
            missedVote = retryMissedVote;
          } else {
            missedVote = createdMissedVote;
            votesCreated++;
          }
        }
        // Garante que a votação tenha as mesmas opções usadas nas demais ocorrências.
        const missedOptionsToEnsure = votingOptions.map((label, index) => ({
          vote_id: missedVote.id,
          label,
          sort_order: index + 1,
        }));
        // Completa opções ausentes sem apagar ou duplicar as já existentes.
        const { error: insertMissedOptionsError } = await supabase
          .from("leadership_vote_options")
          .upsert(missedOptionsToEnsure, {
            onConflict: "vote_id,label",
            ignoreDuplicates: true,
          });
        if (insertMissedOptionsError) {
          voteErrors++;
          console.error(
            "[Votes] Erro ao garantir opções da votação de ataque não realizado:",
            insertMissedOptionsError.message
          );
        }
      }
    }
    console.log("[Occurrences] Detecção concluída:", {
      warId: savedWar.id,
      attacksAnalyzed,
      occurrencesCreated,
      occurrenceErrors,
      votesCreated,
      voteErrors,
    });
    return NextResponse.json({
      success: true,
      warId: savedWar.id,
      status,
      teamSize: war.teamSize,
      attacksProcessed: attacks.length,
      occurrencesCreated,
      occurrenceErrors,
      votesCreated,
      voteErrors,
      historicalWarsUpdated,
historicalWarErrors,
      warLogStatus: warLogResponse.status,
warLogAvailable: warLogResponse.ok,
warLogEntries: warLogData?.items?.length ?? 0,
warLogPreview: warLogData?.items?.slice(0, 3) ?? [],
      message: "Sincronização concluída.",
    });
  } catch (error) {
    console.error(
      "[Clash API] Erro durante sincronização:",
      error
    );
    return NextResponse.json(
      { error: "Erro inesperado durante a sincronização." },
      { status: 500 }
    );
  }
}
