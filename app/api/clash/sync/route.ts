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
      { error: "Configure o token e a tag no .env.local." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://api.clashofclans.com/v1/clans/${encodeURIComponent(
        clanTag.trim()
      )}/currentwar`,
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
      return NextResponse.json(
        {
          error: "Falha ao consultar a API do Clash of Clans.",
          status: response.status,
        },
        { status: response.status }
      );
    }

    const war = await response.json();

    if (!war.clan || !war.opponent || !war.preparationStartTime) {
      return NextResponse.json(
        { error: "A API retornou dados incompletos da guerra." },
        { status: 502 }
      );
    }

    const preparationStart = parseClashDate(war.preparationStartTime);
    const warStart = parseClashDate(war.startTime);
    const warEnd = parseClashDate(war.endTime);

    if (!preparationStart) {
      return NextResponse.json(
        { error: "Data de preparação inválida na resposta da API." },
        { status: 502 }
      );
    }

    const externalWarTag =
      `${war.clan.tag}:${war.opponent.tag}:${war.preparationStartTime}`;

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

    const opponentMembers: WarMember[] = Array.isArray(war.opponent.members)
      ? war.opponent.members
      : [];

    const clanByTag = new Map<string, WarMember>(
      clanMembers.map((member) => [member.tag, member])
    );

    const opponentByTag = new Map<string, WarMember>(
      opponentMembers.map((member) => [member.tag, member])
    );

    const attacks: Record<string, unknown>[] = [];

    for (const member of clanMembers) {
      for (const attack of member.attacks ?? []) {
        const attacker = clanByTag.get(attack.attackerTag) ?? member;
        const defender = opponentByTag.get(attack.defenderTag);

        if (!attack.attackerTag || !attack.defenderTag) continue;

        attacks.push({
          war_id: savedWar.id,
          attacker_tag: attack.attackerTag,
          attacker_name: attacker.name,
          defender_tag: attack.defenderTag,
          defender_name: defender?.name ?? null,
          attacker_map_position: attacker.mapPosition ?? null,
          defender_map_position: defender?.mapPosition ?? null,
          stars: attack.stars ?? 0,
          destruction_percent: attack.destructionPercentage ?? 0,
          attack_order: attack.order ?? null,
          external_attack_key: `${attack.attackerTag}:${attack.order}`,
          raw_payload: attack,
        });
      }
    }

    for (const member of opponentMembers) {
      for (const attack of member.attacks ?? []) {
        const attacker = opponentByTag.get(attack.attackerTag) ?? member;
        const defender = clanByTag.get(attack.defenderTag);

        if (!attack.attackerTag || !attack.defenderTag) continue;

        attacks.push({
          war_id: savedWar.id,
          attacker_tag: attack.attackerTag,
          attacker_name: attacker.name,
          defender_tag: attack.defenderTag,
          defender_name: defender?.name ?? null,
          attacker_map_position: attacker.mapPosition ?? null,
          defender_map_position: defender?.mapPosition ?? null,
          stars: attack.stars ?? 0,
          destruction_percent: attack.destructionPercentage ?? 0,
          attack_order: attack.order ?? null,
          external_attack_key: `${attack.attackerTag}:${attack.order}`,
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
            error: "A guerra foi salva, mas houve falha ao salvar os ataques.",
            details: attacksError.message,
            warId: savedWar.id,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      warId: savedWar.id,
      status,
      teamSize: war.teamSize,
      attacksProcessed: attacks.length,
      message: "Sincronização concluída.",
    });
  } catch {
    return NextResponse.json(
      { error: "Erro inesperado durante a sincronização." },
      { status: 500 }
    );
  }
}
