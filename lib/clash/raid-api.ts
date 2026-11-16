
import { normalizeTag } from "@/lib/clash/strategy";

const API_BASE = "https://cocproxy.royaleapi.dev/v1";

// =====================================================
// RAID
// =====================================================

export type RaidMember = {
  tag: string;
  name: string;
  attacks: number;
  attackLimit: number;
  bonusAttackLimit: number;
  capitalResourcesLooted: number;
};

export type RaidSeason = {
  state: "ended" | "ongoing";
  startTime: string;
  endTime: string;
  capitalTotalLoot: number;
  raidsCompleted: number;
  totalAttacks: number;
  enemyDistrictsDestroyed: number;
  offensiveReward: number;
  defensiveReward: number;
  members?: RaidMember[];
  attackLog?: unknown[];
  defenseLog?: unknown[];
};

type RaidSeasonsResponse = {
  items: RaidSeason[];
  paging?: {
    after?: string;
    before?: string;
  };
};

export async function getCapitalRaidSeasons(
  clanTag: string,
  limit = 10
): Promise<RaidSeasonsResponse> {
  const token = process.env.CLASH_OF_CLANS_API_TOKEN;

  if (!token) {
    throw new Error("Token da API do Clash não configurado.");
  }

  const normalizedTag = normalizeTag(clanTag);

  if (!normalizedTag) {
    throw new Error("Tag do clã inválida.");
  }

  const tag = encodeURIComponent(`#${normalizedTag}`);

  const response = await fetch(
    `${API_BASE}/clans/${tag}/capitalraidseasons?limit=${limit}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const details = await response.text();

    throw new Error(
      `Erro ao consultar Raide (${response.status}): ${details}`
    );
  }

  return (await response.json()) as RaidSeasonsResponse;
}

// =====================================================
// CLAN MEMBERS
// =====================================================

// Cargos retornados pela API do Clash of Clans:
// leader = Líder
// coLeader = Colíder
// admin = Ancião (Elder)
// member = Membro

export type ClashRole =
  | "leader"
  | "coLeader"
  | "admin"
  | "member";

export type ClanMember = {
  tag: string;
  name: string;
  role: ClashRole;
};

type ClashClanResponse = {
  memberList?: {
    tag: string;
    name: string;
    role: ClashRole;
  }[];
};

export async function getClanMembers(
  clanTag: string
): Promise<ClanMember[]> {
  const token = process.env.CLASH_OF_CLANS_API_TOKEN;

  if (!token) {
    throw new Error("Token da API do Clash não configurado.");
  }

  const normalizedTag = normalizeTag(clanTag);

  if (!normalizedTag) {
    throw new Error("Tag do clã inválida.");
  }

  const tag = encodeURIComponent(`#${normalizedTag}`);

  const response = await fetch(`${API_BASE}/clans/${tag}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Erro ao consultar membros (${response.status}).`
    );
  }

  const data = (await response.json()) as ClashClanResponse;

  return (data.memberList ?? []).map((member) => {
    if (
      !["leader", "coLeader", "admin", "member"].includes(
        member.role
      )
    ) {
      throw new Error(
        `Cargo desconhecido retornado pela API para ${member.name}.`
      );
    }

    return {
      tag: member.tag,
      name: member.name,
      role: member.role,
    };
  });
}

// =====================================================
// CLAN GAMES
// =====================================================

export type ClanGamesMember = {
  tag: string;
  name: string;
  achievementValue: number;
  achievementFound: boolean;
};

type PlayerAchievement = {
  name: string;
  value: number;
};

type PlayerProfile = {
  tag: string;
  name: string;
  achievements?: PlayerAchievement[];
};

export async function getClanGamesProgress(
  clanTag: string
): Promise<ClanGamesMember[]> {
  const token = process.env.CLASH_OF_CLANS_API_TOKEN;

  if (!token) {
    throw new Error("Token da API do Clash não configurado.");
  }

  const members = await getClanMembers(clanTag);

  const results: ClanGamesMember[] = [];
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < members.length) {
      const member = members[currentIndex++];

      const tag = encodeURIComponent(member.tag);

      const response = await fetch(
        `${API_BASE}/players/${tag}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Erro ao consultar o jogador ${member.name} (${response.status}).`
        );
      }

      const profile = (await response.json()) as PlayerProfile;

      const achievement = profile.achievements?.find(
        (item) =>
          item.name.toLowerCase() === "games champion"
      );

      results.push({
        tag: member.tag,
        name: member.name,
        achievementValue: achievement?.value ?? 0,
        achievementFound: Boolean(achievement),
      });
    }
  }

  const workers = Array.from(
    { length: Math.min(5, members.length) },
    () => worker()
  );

  await Promise.all(workers);

  return results.sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
