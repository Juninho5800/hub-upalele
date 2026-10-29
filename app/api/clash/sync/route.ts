
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type WarAttack = {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  destructionPercentage: number;
  order: number;
};

type WarMember = {
  tag: string;
  name: string;
  mapPosition: number;
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

function normalizeTag(tag: string): string {
  return tag.replace(/^#/, "").toUpperCase();
}

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

  if (!profile?.is_active || profile.role !== "leader") {
    return NextResponse.json(
      { error: "Somente o líder ativo pode sincronizar guerras." },
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
      !war.clan ||
      !war.opponent ||
      !war.preparationStartTime
    ) {
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

    const clanMembers: WarMember[] = Array.isArray(
      war.clan.members
    )
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

    // Salva os ataques dos dois lados da guerra.
    const attacks: Record<string, unknown>[] = [];

    for (const member of clanMembers) {
      for (const attack of member.attacks ?? []) {
        if (!attack.attackerTag || !attack.defenderTag) {
          continue;
        }

        const attacker =
          clanByTag.get(normalizeTag(attack.attackerTag)) ??
          member;

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

    // Detecção automática dos desvios no primeiro ataque.
    // A ordem dos ataques é importante para calcular as estrelas
    // que cada vila já havia recebido no momento do ataque.
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
        (item) => item.attackerTag && item.defenderTag
      )
      .sort((a, b) => a.attack.order - b.attack.order);

    const bestStarsByEnemy = new Map<string, number>();
    const playersAlreadyAttacked = new Set<string>();

    let occurrencesCreated = 0;
    let occurrenceErrors = 0;

    for (const item of orderedAttacks) {
      const {
        member,
        attack,
        attackerTag,
        defenderTag,
      } = item;

      const defender = opponentByTag.get(defenderTag);

      if (!defender) continue;

      const isFirstAttack =
        !playersAlreadyAttacked.has(attackerTag);

      playersAlreadyAttacked.add(attackerTag);

      if (isFirstAttack) {
        const initialPosition = member.mapPosition + 2;

        const availableEnemies = opponentMembers.filter(
          (enemy) =>
            (bestStarsByEnemy.get(
              normalizeTag(enemy.tag)
            ) ?? 0) < 3
        );

        const initialTarget = availableEnemies.find(
          (enemy) => enemy.mapPosition === initialPosition
        );

        const below = availableEnemies
          .filter(
            (enemy) => enemy.mapPosition > initialPosition
          )
          .sort((a, b) => a.mapPosition - b.mapPosition);

        const above = availableEnemies
          .filter(
            (enemy) => enemy.mapPosition < initialPosition
          )
          .sort((a, b) => b.mapPosition - a.mapPosition);

        const expectedTarget =
          initialTarget ?? below[0] ?? above[0] ?? null;

        if (
          expectedTarget &&
          normalizeTag(expectedTarget.tag) !== defenderTag
        ) {
          const externalAttackKey =
            `first:${savedWar.id}:${attackerTag}:${attack.order}`;

          const ruleReference = initialTarget
            ? "Item 2.14"
            : below.length
              ? "Itens 2.15 e 2.16"
              : "Item 2.17";

          const description =
            `ERRO DE ESTRATÉGIA — 1º ATAQUE\n\n` +
            `Jogador: ${member.name} (#${member.mapPosition}).\n` +
            `Alvo atacado: ${defender.name} (#${defender.mapPosition}).\n` +
            `Alvo esperado: ${expectedTarget.name} (#${expectedTarget.mapPosition}).\n` +
            `Motivo: divergência em relação ao alvo esperado conforme ${ruleReference} do memorial.\n\n` +
            `Ocorrência detectada automaticamente pelo HUB. ` +
            `A liderança deve conferir o mapa e analisar o caso antes de decidir.`; 

          // A chave única impede registrar novamente o mesmo ataque
          // em sincronizações futuras.
          const { data: inserted, error: occurrenceError } =
            await supabase
              .from("war_occurrences")
              .upsert(
                {
                  war_id: savedWar.id,
                  external_attack_key: externalAttackKey,
                  attack_order: attack.order,
                  player_position: member.mapPosition,
                  title: "Erro de estratégia — 1º ataque",
                  occurrence_type: "strategy_error",
                  status: "pending",
                  player_name: member.name,
                  player_tag: member.tag,
                  attack_number: 1,
                  attacked_target_name: defender.name,
                  attacked_target_tag: defender.tag,
                  attacked_target_position: defender.mapPosition,
                  expected_target_name: expectedTarget.name,
                  expected_target_tag: expectedTarget.tag,
                  expected_target_position:
                    expectedTarget.mapPosition,
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
          } else if (inserted && inserted.length > 0) {
            occurrencesCreated++;
          }
        }
      }

      // Atualiza as estrelas conhecidas após avaliar o ataque.
      const previousStars =
        bestStarsByEnemy.get(defenderTag) ?? 0;

      bestStarsByEnemy.set(
        defenderTag,
        Math.max(previousStars, attack.stars ?? 0)
      );
    }

    console.log("[Occurrences] Detecção concluída:", {
      warId: savedWar.id,
      attacksAnalyzed: orderedAttacks.length,
      occurrencesCreated,
      occurrenceErrors,
    });

    return NextResponse.json({
      success: true,
      warId: savedWar.id,
      status,
      teamSize: war.teamSize,
      attacksProcessed: attacks.length,
      occurrencesCreated,
      occurrenceErrors,
      message: "Sincronização concluída.",
    });
  } catch (error) {
    console.error("[Clash API] Erro durante sincronização:", error);

    return NextResponse.json(
      { error: "Erro inesperado durante a sincronização." },
      { status: 500 }
    );
  }
}
