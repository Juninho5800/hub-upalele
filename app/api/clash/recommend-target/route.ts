
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Attack = {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  order: number;
};

type Member = {
  tag: string;
  name: string;
  mapPosition: number;
  townhallLevel?: number;
  townHallLevel?: number;
  attacks?: Attack[];
};

type Side = {
  tag: string;
  name: string;
  members: Member[];
};

type War = {
  state: string;
  clan: Side;
  opponent: Side;
};

function normalizeTag(tag: string) {
  return tag.replace(/^#/, "").toUpperCase();
}

function getTownHallLevel(member: Member) {
  return member.townhallLevel ?? member.townHallLevel;
}

function getTarget(
  type: "1" | "2",
  player: Member,
  allies: Member[],
  enemies: Member[]
) {
  const attacksAgainstEnemies = allies.flatMap(
    (ally) => ally.attacks ?? []
  );

  const available = enemies.filter((enemy) => {
    const bestStarsReceived = attacksAgainstEnemies
      .filter(
        (attack) =>
          normalizeTag(attack.defenderTag) ===
          normalizeTag(enemy.tag)
      )
      .reduce(
        (best, attack) => Math.max(best, attack.stars),
        0
      );

    return bestStarsReceived < 3;
  });

  if (!available.length) {
    return {
      target: null,
      reason: "Não há alvos com estrelas disponíveis.",
    };
  }

  if (type === "1") {
    const initialPosition = player.mapPosition + 2;

    const initial = available.find(
      (enemy) => enemy.mapPosition === initialPosition
    );

    if (initial) {
      return {
        target: initial,
        reason:
          "Alvo inicial: duas posições abaixo do espelho, conforme o item 2.14. A vila ainda possui estrelas disponíveis.",
      };
    }

    const below = available
      .filter((enemy) => enemy.mapPosition > initialPosition)
      .sort((a, b) => a.mapPosition - b.mapPosition);

    if (below.length) {
      return {
        target: below[0],
        reason:
          "O alvo inicial não está disponível. Este é o próximo alvo abaixo com estrelas disponíveis, conforme os itens 2.15 e 2.16.",
      };
    }

    const above = available
      .filter((enemy) => enemy.mapPosition < initialPosition)
      .sort((a, b) => b.mapPosition - a.mapPosition);

    return {
      target: above[0] ?? null,
      reason:
        "Não há alvos disponíveis abaixo. Esta é a primeira vila disponível subindo no mapa, conforme o item 2.17.",
    };
  }

  const playerCv = getTownHallLevel(player);

  // Não inventamos a prioridade se não conhecemos o CV do jogador.
  if (playerCv == null) {
    return {
      target: null,
      reason:
        "Não foi possível identificar o CV do jogador na resposta da guerra.",
    };
  }

  const sameCv = available
    .filter((enemy) => getTownHallLevel(enemy) === playerCv)
    .sort((a, b) => b.mapPosition - a.mapPosition);

  const lowerCv = available
    .filter((enemy) => {
      const enemyCv = getTownHallLevel(enemy);
      return enemyCv != null && enemyCv < playerCv;
    })
    .sort((a, b) => b.mapPosition - a.mapPosition);

  const higherCv = available
    .filter((enemy) => {
      const enemyCv = getTownHallLevel(enemy);
      return enemyCv != null && enemyCv > playerCv;
    })
    .sort((a, b) => b.mapPosition - a.mapPosition);

  const target =
    sameCv[0] ?? lowerCv[0] ?? higherCv[0] ?? null;

  if (!target) {
    return {
      target: null,
      reason:
        "Não foi possível encontrar um alvo disponível com CV identificado.",
    };
  }

  return {
    target,
    reason:
      "Prioridade aplicada conforme os itens 2.18–2.20: CV igual, depois CV inferior e, por último, CV superior; em cada categoria, de baixo para cima.",
  };
}

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Você precisa estar autenticado." },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("player_tag, in_game_name, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.is_active || !profile.player_tag) {
    return NextResponse.json(
      {
        error:
          "Seu perfil precisa estar ativo e possuir a tag do jogador cadastrada.",
      },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type !== "1" && type !== "2") {
    return NextResponse.json(
      { error: "Informe type=1 ou type=2." },
      { status: 400 }
    );
  }

  const token = process.env.CLASH_OF_CLANS_API_TOKEN;
  const clanTag = process.env.CLASH_OF_CLANS_CLAN_TAG;

  if (!token || !clanTag) {
    return NextResponse.json(
      { error: "Token ou tag do clã não configurado." },
      { status: 500 }
    );
  }

  const normalizedClanTag = normalizeTag(clanTag);
  const encodedTag = encodeURIComponent(`#${normalizedClanTag}`);

  try {
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

    if (!response.ok) {
      const details = await response.text();

      console.error("[Clash API] recommend-target:", {
        status: response.status,
        details,
      });

      return NextResponse.json(
        {
          error: "Não foi possível consultar a guerra atual.",
          status: response.status,
          details,
        },
        { status: response.status }
      );
    }

    const war = (await response.json()) as War;

    if (
      !war.clan?.members ||
      !war.opponent?.members ||
      !["preparation", "inWar"].includes(war.state)
    ) {
      return NextResponse.json(
        {
          error:
            "Não há uma guerra válida para recomendar alvos.",
        },
        { status: 409 }
      );
    }

    const playerTag = normalizeTag(profile.player_tag);

    const normalizeMember = (member: Member): Member => ({
      ...member,
      tag: normalizeTag(member.tag),
      townHallLevel: getTownHallLevel(member),
    });

    const allies = war.clan.members.map(normalizeMember);
    const enemies = war.opponent.members.map(normalizeMember);

    const player = allies.find(
      (member) => member.tag === playerTag
    );

    if (!player) {
      return NextResponse.json(
        {
          error:
            "Seu jogador não foi encontrado no mapa aliado desta guerra. Confira sua tag e participação.",
        },
        { status: 404 }
      );
    }

    const attacksUsed = player.attacks?.length ?? 0;

    if (attacksUsed >= 2) {
      return NextResponse.json({
        success: true,
        recommendation: null,
        message: "Você já realizou os dois ataques desta guerra.",
      });
    }

    if (type === "1" && attacksUsed >= 1) {
      return NextResponse.json({
        success: true,
        recommendation: null,
        message:
          "Seu primeiro ataque já foi registrado. Selecione o segundo ataque.",
      });
    }

    if (type === "2" && attacksUsed < 1) {
      return NextResponse.json({
        success: true,
        recommendation: null,
        message:
          "A API ainda não registra seu primeiro ataque nesta guerra.",
      });
    }

    const { target, reason } = getTarget(
      type,
      player,
      allies,
      enemies
    );

    if (!target) {
      return NextResponse.json({
        success: true,
        recommendation: null,
        message: reason,
      });
    }

    return NextResponse.json({
      success: true,
      player: {
        tag: player.tag,
        name: player.name,
        position: player.mapPosition,
        townHallLevel: getTownHallLevel(player) ?? null,
        attacksUsed,
      },
      attackType: type,
      recommendation: {
        tag: target.tag,
        name: target.name,
        position: target.mapPosition,
        townHallLevel: getTownHallLevel(target) ?? null,
      },
      reason,
      warning:
        "Confira o mapa antes de atacar. Se outro jogador estiver atacando o alvo, aguarde o término, conforme o item 2.9 do memorial.",
    });
  } catch (error) {
    console.error(
      "[Clash API] Erro ao recomendar alvo:",
      error
    );

    return NextResponse.json(
      { error: "Erro inesperado ao calcular a recomendação." },
      { status: 500 }
    );
  }
}
