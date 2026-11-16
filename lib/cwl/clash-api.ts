import { normalizeTag } from "@/lib/clash/strategy";

const API_BASE = "https://cocproxy.royaleapi.dev/v1";

export type CwlGroup = {
  state: string;
  season: string;
  clans: {
    tag: string;
    name: string;
    clanLevel?: number;
    members?: {
      tag: string;
      name: string;
      townHallLevel?: number;
    }[];
  }[];
  rounds: {
    warTags: string[];
  }[];
};

export type CwlWarMember = {
  tag: string;
  name: string;
  mapPosition?: number;
  townhallLevel?: number;
  attacks?: {
    attackerTag: string;
    defenderTag: string;
    stars: number;
    destructionPercentage: number;
    order: number;
  }[];
};

export type CwlWarSide = {
  tag: string;
  name: string;
  stars?: number;
  destructionPercentage?: number;
  attacks?: number;
  members?: CwlWarMember[];
};

export type CwlWar = {
  state: string;
  teamSize?: number;
  preparationStartTime?: string;
  startTime?: string;
  endTime?: string;
  clan: CwlWarSide;
  opponent: CwlWarSide;
};

async function apiRequest<T>(path: string): Promise<T> {
  const token = process.env.CLASH_OF_CLANS_API_TOKEN;

  if (!token) {
    throw new Error("Token da API do Clash não configurado.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Clash API retornou ${response.status}: ${details}`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("A API do Clash retornou uma resposta JSON inválida.");
  }
}

export async function getCwlGroup(
  clanTag: string
): Promise<CwlGroup> {
  const normalizedTag = normalizeTag(clanTag);

  if (!normalizedTag) {
    throw new Error("Tag do clã inválida.");
  }

  const tag = encodeURIComponent(`#${normalizedTag}`);

  return apiRequest<CwlGroup>(
    `/clans/${tag}/currentwar/leaguegroup`
  );
}

export async function getCwlWar(
  warTag: string
): Promise<CwlWar> {
  const normalizedTag = normalizeTag(warTag);

  if (!normalizedTag) {
    throw new Error("Tag da guerra inválida.");
  }

  const tag = encodeURIComponent(`#${normalizedTag}`);

  return apiRequest<CwlWar>(
    `/clanwarleagues/wars/${tag}`
  );
}

export function parseCwlDate(
  value?: string | null
): string | null {
  if (!value) return null;

  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d+))?Z$/
  );

  if (!match) return null;

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second,
    milliseconds = "0",
  ] = match;

  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number((milliseconds + "000").slice(0, 3))
  );

  const date = new Date(timestamp);

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return date.toISOString();
}

export function orientCwlWar(
  war: CwlWar,
  clanTag: string
): CwlWar {
  const expectedTag = normalizeTag(clanTag);

  if (!expectedTag) {
    throw new Error("Tag do clã configurado é inválida.");
  }

  if (normalizeTag(war.clan.tag) === expectedTag) {
    return war;
  }

  if (normalizeTag(war.opponent.tag) === expectedTag) {
    return {
      ...war,
      clan: war.opponent,
      opponent: war.clan,
    };
  }

  throw new Error(
    "O confronto consultado não pertence ao clã configurado."
  );
}
