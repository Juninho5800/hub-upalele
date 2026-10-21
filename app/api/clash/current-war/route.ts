
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.CLASH_OF_CLANS_API_TOKEN;
  const clanTag = process.env.CLASH_OF_CLANS_CLAN_TAG;

  if (!token || !clanTag) {
    return NextResponse.json(
      { error: "Token ou tag do clã não configurado no .env.local." },
      { status: 500 }
    );
  }

  const encodedTag = encodeURIComponent(clanTag.trim());

  try {
    const response = await fetch(
      `https://api.clashofclans.com/v1/clans/${encodedTag}/currentwar`,
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
        connected: true,
        inWar: false,
        message:
          "Clã encontrado, mas não há dados de guerra disponíveis. Pode não haver guerra ativa ou os dados podem não estar acessíveis.",
      });
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Falha ao consultar a guerra na API do Clash of Clans.",
          status: response.status,
          details:
            response.status === 403
              ? "Confira a chave da API e o IP autorizado."
              : response.status === 429
                ? "Limite de consultas atingido. Tente novamente mais tarde."
                : "Confira a configuração e tente novamente.",
        },
        { status: response.status }
      );
    }

    const war = await response.json();

    return NextResponse.json({
      connected: true,
      inWar: war.state !== "notInWar",
      state: war.state,
      teamSize: war.teamSize,
      attacksPerMember: war.attacksPerMember ?? null,
      preparationStartTime: war.preparationStartTime ?? null,
      startTime: war.startTime ?? null,
      endTime: war.endTime ?? null,
      clan: war.clan
        ? {
            tag: war.clan.tag,
            name: war.clan.name,
            stars: war.clan.stars,
            destructionPercentage: war.clan.destructionPercentage,
            attacks: war.clan.attacks ?? 0,
            members: war.clan.members ?? [],
          }
        : null,
      opponent: war.opponent
        ? {
            tag: war.opponent.tag,
            name: war.opponent.name,
            stars: war.opponent.stars,
            destructionPercentage: war.opponent.destructionPercentage,
            attacks: war.opponent.attacks ?? 0,
            members: war.opponent.members ?? [],
          }
        : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível conectar à API do Clash of Clans." },
      { status: 502 }
    );
  }
}
