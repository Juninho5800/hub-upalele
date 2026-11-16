import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calculateMonthlySelection,
  type SelectionAttack,
  type SelectionDefense,
} from "@/lib/cwl/selection";

export const dynamic = "force-dynamic";

// Tag oficial do clã UPALELE, sem o caractere "#".
const OFFICIAL_CLAN_TAG = "PLV2VQQP";

type WarMember = {
  tag?: string;
  name?: string;
  townhallLevel?: number;
  mapPosition?: number;
  attacks?: {
    attackerTag?: string;
    defenderTag?: string;
    stars?: number;
    destructionPercentage?: number;
    order?: number;
  }[];
};

type WarSide = {
  tag?: string;
  members?: WarMember[];
};

type WarPayload = {
  state?: string;
  clan?: WarSide;
  opponent?: WarSide;
};

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toUpperCase();
}

function getNextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString();
}

function isValidAttackResult(
  stars: unknown,
  destruction: unknown
): boolean {
  return (
    typeof stars === "number" &&
    Number.isInteger(stars) &&
    stars >= 0 &&
    stars <= 3 &&
    typeof destruction === "number" &&
    Number.isFinite(destruction) &&
    destruction >= 0 &&
    destruction <= 100
  );
}

export async function GET(request: Request) {
  try {
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
      .select("role,is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Erro ao validar perfil CWL:", profileError);
      return NextResponse.json(
        { error: "Não foi possível validar seu perfil." },
        { status: 500 }
      );
    }

    if (profile?.is_active !== true || !profile.role) {
      return NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const referenceMonth = url.searchParams.get("month")?.trim();

    if (
      !referenceMonth ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)
    ) {
      return NextResponse.json(
        { error: "Informe o mês no formato YYYY-MM." },
        { status: 400 }
      );
    }

    const startDate = `${referenceMonth}-01T00:00:00.000Z`;
    const endDate = getNextMonth(referenceMonth);

    const { data: wars, error: warsError } = await supabase
      .from("wars")
      .select("id,war_end,status,war_type,raw_payload")
      .eq("war_type", "clan_war")
      .eq("status", "ended")
      .gte("war_end", startDate)
      .lt("war_end", endDate)
      .order("war_end", { ascending: true });

    if (warsError) {
      console.error("Erro ao consultar guerras da seleção CWL:", warsError);
      return NextResponse.json(
        { error: "Não foi possível consultar as guerras." },
        { status: 500 }
      );
    }

    if (!wars?.length) {
      return NextResponse.json(
        {
          error: "Nenhuma guerra normal encerrada foi encontrada neste mês.",
          referenceMonth,
        },
        { status: 404 }
      );
    }

    const incompleteWars: {
      warId: string;
      warEnd: string | null;
      reason: string;
    }[] = [];

    const monthlyAttacks: SelectionAttack[] = [];
    const monthlyDefenses: SelectionDefense[] = [];

    for (const war of wars) {
      const payload = war.raw_payload as WarPayload | null;

      if (payload?.state !== "warEnded") {
        incompleteWars.push({
          warId: war.id,
          warEnd: war.war_end,
          reason: "Payload não confirma o encerramento da guerra.",
        });
        continue;
      }

      if (
        !payload.clan?.tag ||
        normalizeTag(payload.clan.tag) !== OFFICIAL_CLAN_TAG
      ) {
        // Não mistura confrontos de outros clãs na seleção mensal do UPALELE.
        incompleteWars.push({
          warId: war.id,
          warEnd: war.war_end,
          reason: "A guerra não pertence ao clã UPALELE ou não possui tag válida.",
        });
        continue;
      }

      const clanMembers = payload.clan.members;
      const opponentMembers = payload.opponent?.members;

      if (
        !Array.isArray(clanMembers) ||
        !Array.isArray(opponentMembers) ||
        !payload.opponent?.tag
      ) {
        incompleteWars.push({
          warId: war.id,
          warEnd: war.war_end,
          reason:
            "Dados dos dois clãs ausentes no payload; não é possível calcular ataque e defesa.",
        });
        continue;
      }

      const clanTags = new Set(
        clanMembers
          .map((member) => member.tag)
          .filter((tag): tag is string => Boolean(tag))
          .map(normalizeTag)
      );

      const opponentTags = new Set(
        opponentMembers
          .map((member) => member.tag)
          .filter((tag): tag is string => Boolean(tag))
          .map(normalizeTag)
      );

      if (
        clanMembers.length === 0 ||
        opponentMembers.length === 0 ||
        clanTags.size !== clanMembers.length ||
        opponentTags.size !== opponentMembers.length
      ) {
        incompleteWars.push({
          warId: war.id,
          warEnd: war.war_end,
          reason: "Existem membros sem tag, listas vazias ou tags duplicadas.",
        });
        continue;
      }

      const clanByTag = new Map(
        clanMembers.map((member) => [
          normalizeTag(member.tag ?? ""),
          member,
        ])
      );

      const opponentByTag = new Map(
        opponentMembers.map((member) => [
          normalizeTag(member.tag ?? ""),
          member,
        ])
      );

      const expectedAttacks: {
        key: string;
        attack: NonNullable<WarMember["attacks"]>[number];
      }[] = [];

      let invalidPayloadAttack = false;

      for (const member of clanMembers) {
        for (const attack of member.attacks ?? []) {
          if (
            !attack.attackerTag ||
            !attack.defenderTag ||
            !clanTags.has(normalizeTag(attack.attackerTag)) ||
            !opponentTags.has(normalizeTag(attack.defenderTag)) ||
            !Number.isInteger(attack.order) ||
            (attack.order ?? 0) < 1 ||
            !isValidAttackResult(
              attack.stars,
              attack.destructionPercentage
            )
          ) {
            invalidPayloadAttack = true;
            continue;
          }

          expectedAttacks.push({
            key: `${normalizeTag(attack.attackerTag)}:${attack.order}`,
            attack,
          });
        }
      }

      const expectedKeys = new Set(expectedAttacks.map((item) => item.key));

      if (
        invalidPayloadAttack ||
        expectedKeys.size !== expectedAttacks.length
      ) {
        incompleteWars.push({
          warId: war.id,
          warEnd: war.war_end,
          reason:
            "O payload contém ataques próprios inválidos ou duplicados.",
        });
        continue;
      }

      const { data: savedAttacks, error: attacksError } = await supabase
        .from("war_attacks")
        .select(
          "attacker_tag,attacker_name,stars,destruction_percent,attack_order"
        )
        .eq("war_id", war.id);

      if (attacksError || !savedAttacks) {
        console.error("Erro ao consultar ataques salvos:", attacksError);
        incompleteWars.push({
          warId: war.id,
          warEnd: war.war_end,
          reason: "Não foi possível consultar os ataques salvos.",
        });
        continue;
      }

      const savedClanAttacks = savedAttacks.filter(
        (attack) =>
          typeof attack.attacker_tag === "string" &&
          clanTags.has(normalizeTag(attack.attacker_tag))
      );

      const savedKeys = new Set(
        savedClanAttacks.map(
          (attack) =>
            `${normalizeTag(attack.attacker_tag)}:${attack.attack_order}`
        )
      );

      const savedKeysAreUnique = savedKeys.size === savedClanAttacks.length;
      const missingAttacks = expectedAttacks.filter(
        ({ key }) => !savedKeys.has(key)
      );

      if (
        !savedKeysAreUnique ||
        savedClanAttacks.length !== expectedAttacks.length ||
        missingAttacks.length > 0
      ) {
        incompleteWars.push({
          warId: war.id,
          warEnd: war.war_end,
          reason: `Ataques inconsistentes. Payload: ${expectedAttacks.length}; banco: ${savedClanAttacks.length}.`,
        });
        continue;
      }

      const savedByKey = new Map(
        savedClanAttacks.map((attack) => [
          `${normalizeTag(attack.attacker_tag)}:${attack.attack_order}`,
          attack,
        ])
      );

      const attacksStartIndex = monthlyAttacks.length;
      let warHasMissingMetadata = false;

      for (const { key, attack: payloadAttack } of expectedAttacks) {
        const saved = savedByKey.get(key);
        const attacker = clanByTag.get(
          normalizeTag(payloadAttack.attackerTag!)
        );
        const defender = opponentByTag.get(
          normalizeTag(payloadAttack.defenderTag!)
        );

        if (
          !saved ||
          !attacker?.townhallLevel ||
          !defender?.townhallLevel ||
          !defender.mapPosition ||
          !isValidAttackResult(saved.stars, saved.destruction_percent)
        ) {
          warHasMissingMetadata = true;
          break;
        }

        monthlyAttacks.push({
          attacker_tag: saved.attacker_tag,
          attacker_name: saved.attacker_name ?? attacker.name ?? "",
          stars: Number(saved.stars),
          destruction_percent: Number(saved.destruction_percent),
          attacker_town_hall: attacker.townhallLevel,
          defender_town_hall: defender.townhallLevel,
          defender_position: defender.mapPosition,
        });
      }

      if (warHasMissingMetadata) {
        monthlyAttacks.splice(attacksStartIndex);
        incompleteWars.push({
          warId: war.id,
          warEnd: war.war_end,
          reason:
            "Faltam CV, posição no mapa ou resultados válidos para calcular a pontuação de ataque.",
        });
        continue;
      }

      // Ataques do adversário contra membros do UPALELE geram pontos defensivos.
      for (const opponentMember of opponentMembers) {
        for (const attack of opponentMember.attacks ?? []) {
          if (
            !attack.attackerTag ||
            !attack.defenderTag ||
            !opponentTags.has(normalizeTag(attack.attackerTag)) ||
            !clanTags.has(normalizeTag(attack.defenderTag))
          ) {
            continue;
          }

          if (
            typeof attack.stars !== "number" ||
            !Number.isInteger(attack.stars) ||
            attack.stars < 0 ||
            attack.stars > 3
          ) {
            warHasMissingMetadata = true;
            break;
          }

          monthlyDefenses.push({
            defender_tag: attack.defenderTag,
            stars_conceded: attack.stars,
          });
        }

        if (warHasMissingMetadata) break;
      }

      if (warHasMissingMetadata) {
        incompleteWars.push({
          warId: war.id,
          warEnd: war.war_end,
          reason: "Existe ataque recebido com dados inválidos no payload.",
        });
      }
    }

    if (incompleteWars.length > 0) {
      return NextResponse.json(
        {
          success: false,
          blocked: true,
          referenceMonth,
          message:
            "A seleção definitiva foi bloqueada porque existem guerras com dados incompletos ou que não correspondem ao clã UPALELE.",
          incompleteWars,
        },
        { status: 409 }
      );
    }

    const selection = calculateMonthlySelection(
      monthlyAttacks,
      monthlyDefenses,
      referenceMonth
    );

    return NextResponse.json({
      success: true,
      blocked: false,
      referenceMonth,
      warsAnalyzed: wars.length,
      attacksAnalyzed: monthlyAttacks.length,
      defensesAnalyzed: monthlyDefenses.length,
      selection,
    });
  } catch (error) {
    console.error("Erro ao calcular seleção mensal CWL:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao calcular a seleção mensal CWL." },
      { status: 500 }
    );
  }
}
