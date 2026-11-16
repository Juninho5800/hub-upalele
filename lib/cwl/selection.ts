export type SelectionAttack = {
  attacker_tag: string;
  attacker_name: string;
  stars: number;
  destruction_percent: number;
  attacker_town_hall: number;
  defender_town_hall: number;
  defender_position: number;
};

export type SelectionDefense = {
  defender_tag: string;
  stars_conceded: number;
};

export type SelectionPlayer = {
  playerTag: string;
  playerName: string;
  attacksCount: number;
  totalStars: number;
  averageStars: number;
  averageDestruction: number;
  selectionScore: number;
  totalAttackPoints: number;
  totalDefensePoints: number;
  totalPoints: number;
  defensesCount: number;
  selectionPosition: number;
  initialRole: "starter" | "reserve" | "not_selected";
  tieWithPrevious: boolean;
};

export type SelectionTieGroup = {
  candidates: SelectionPlayer[];
  firstPosition: number;
  lastPosition: number;
};

export type SelectionBoundaryTie = {
  boundaryPosition: 15 | 20;
  decision: "starter_reserve" | "selected_not_selected";
  candidates: SelectionPlayer[];
};

export type SelectionResult = {
  referenceMonth: string;
  players: SelectionPlayer[];
  starters: SelectionPlayer[];
  reserves: SelectionPlayer[];
  tiedGroups: SelectionTieGroup[];
  boundaryTies: SelectionBoundaryTie[];
  requiresLeadershipDecision: boolean;
  excludedPlayers: number;
  playersBelowMinimum: number;
  minimumValidAttacks: number;
};

const MINIMUM_VALID_ATTACKS = 5;

function normalizePlayerTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toUpperCase();
}

function getAttackPoints(attack: SelectionAttack): number {
  const { stars, destruction_percent, attacker_town_hall, defender_town_hall, defender_position } = attack;

  // Queda de conexão: não pontua e não pune.
  if (stars === 0 && destruction_percent < 30) return 0;

  const targetIsHigher = defender_town_hall > attacker_town_hall;
  const targetIsLower = defender_town_hall < attacker_town_hall;

  if (stars === 3) {
    return targetIsHigher && defender_position >= 1 && defender_position <= 8 ? 3.3 : 3;
  }

  if (stars === 2) return targetIsLower ? -3 : 2;
  if (stars === 1) return targetIsLower ? -5 : 1;
  return targetIsHigher ? -2 : targetIsLower ? -7 : -3;
}

function sameRankingCriteria(a: SelectionPlayer, b: SelectionPlayer): boolean {
  return (
    Math.abs(a.totalPoints - b.totalPoints) < 1e-10 &&
    Math.abs(a.totalAttackPoints - b.totalAttackPoints) < 1e-10 &&
    a.totalStars === b.totalStars &&
    Math.abs(a.averageDestruction - b.averageDestruction) < 1e-10 &&
    Math.abs(a.averageStars - b.averageStars) < 1e-10
  );
}

export function calculateMonthlySelection(
  attacks: SelectionAttack[],
  defenses: SelectionDefense[],
  referenceMonth: string
): SelectionResult {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) {
    throw new Error("Mês de referência inválido. Use YYYY-MM.");
  }

  const grouped = new Map<string, {
    playerName: string;
    attacksCount: number;
    totalStars: number;
    totalDestruction: number;
    totalAttackPoints: number;
    totalDefensePoints: number;
    defensesCount: number;
  }>();

  const getOrCreate = (tag: string, name = "") => {
    const playerTag = normalizePlayerTag(tag);
    if (!playerTag) return null;
    const current = grouped.get(playerTag) ?? {
      playerName: name,
      attacksCount: 0,
      totalStars: 0,
      totalDestruction: 0,
      totalAttackPoints: 0,
      totalDefensePoints: 0,
      defensesCount: 0,
    };
    if (name) current.playerName = name;
    grouped.set(playerTag, current);
    return current;
  };

  for (const attack of attacks) {
    const tag = normalizePlayerTag(attack.attacker_tag);
    if (!tag) continue;
    if (
      !Number.isFinite(attack.stars) || attack.stars < 0 || attack.stars > 3 ||
      !Number.isFinite(attack.destruction_percent) || attack.destruction_percent < 0 || attack.destruction_percent > 100 ||
      !Number.isFinite(attack.attacker_town_hall) || attack.attacker_town_hall <= 0 ||
      !Number.isFinite(attack.defender_town_hall) || attack.defender_town_hall <= 0 ||
      !Number.isFinite(attack.defender_position) || attack.defender_position <= 0
    ) {
      throw new Error(`Ataque inválido encontrado para o jogador ${attack.attacker_tag}.`);
    }

    const stats = getOrCreate(tag, attack.attacker_name);
    if (!stats) continue;
    const points = getAttackPoints(attack);
    stats.totalAttackPoints += points;

    // Ataques de 0 estrelas e menos de 30% são descartados da contagem mínima.
    if (attack.stars === 0 && attack.destruction_percent < 30) continue;
    stats.attacksCount += 1;
    stats.totalStars += attack.stars;
    stats.totalDestruction += attack.destruction_percent;
  }

  for (const defense of defenses) {
    const tag = normalizePlayerTag(defense.defender_tag);
    if (!tag) continue;
    if (!Number.isFinite(defense.stars_conceded) || defense.stars_conceded < 0 || defense.stars_conceded > 3) {
      throw new Error(`Defesa inválida encontrada para o jogador ${defense.defender_tag}.`);
    }
    const stats = getOrCreate(tag);
    if (!stats) continue;
    stats.totalDefensePoints += Math.max(0, 3 - defense.stars_conceded);
    stats.defensesCount += 1;
  }

  const rankedPlayers: SelectionPlayer[] = [];
  let playersBelowMinimum = 0;

  for (const [playerTag, stats] of grouped.entries()) {
    if (stats.attacksCount < MINIMUM_VALID_ATTACKS) {
      playersBelowMinimum++;
      continue;
    }
    const averageStars = stats.totalStars / stats.attacksCount;
    const averageDestruction = stats.totalDestruction / stats.attacksCount / 100;
    const totalPoints = stats.totalAttackPoints + stats.totalDefensePoints;

    rankedPlayers.push({
      playerTag,
      playerName: stats.playerName,
      attacksCount: stats.attacksCount,
      totalStars: stats.totalStars,
      averageStars,
      averageDestruction,
      selectionScore: totalPoints,
      totalAttackPoints: stats.totalAttackPoints,
      totalDefensePoints: stats.totalDefensePoints,
      totalPoints,
      defensesCount: stats.defensesCount,
      selectionPosition: 0,
      initialRole: "not_selected",
      tieWithPrevious: false,
    });
  }

  rankedPlayers.sort((a, b) =>
    b.totalPoints - a.totalPoints ||
    b.totalAttackPoints - a.totalAttackPoints ||
    b.totalStars - a.totalStars ||
    b.averageDestruction - a.averageDestruction ||
    b.averageStars - a.averageStars
  );

  rankedPlayers.forEach((player, index) => {
    player.selectionPosition = index + 1;
    player.initialRole = index < 15 ? "starter" : index < 20 ? "reserve" : "not_selected";
    player.tieWithPrevious = index > 0 && sameRankingCriteria(player, rankedPlayers[index - 1]);
  });

  const tiedGroups: SelectionTieGroup[] = [];
  let groupStart = 0;
  while (groupStart < rankedPlayers.length) {
    let groupEnd = groupStart;
    while (groupEnd + 1 < rankedPlayers.length && sameRankingCriteria(rankedPlayers[groupStart], rankedPlayers[groupEnd + 1])) {
      groupEnd++;
    }
    if (groupEnd > groupStart) {
      tiedGroups.push({
        candidates: rankedPlayers.slice(groupStart, groupEnd + 1),
        firstPosition: groupStart + 1,
        lastPosition: groupEnd + 1,
      });
    }
    groupStart = groupEnd + 1;
  }

  const boundaryTies: SelectionBoundaryTie[] = [];
  for (const group of tiedGroups) {
    if (group.firstPosition <= 15 && group.lastPosition >= 16) {
      boundaryTies.push({ boundaryPosition: 15, decision: "starter_reserve", candidates: group.candidates });
    }
    if (group.firstPosition <= 20 && group.lastPosition >= 21) {
      boundaryTies.push({ boundaryPosition: 20, decision: "selected_not_selected", candidates: group.candidates });
    }
  }

  const selected = rankedPlayers.slice(0, 20);
  return {
    referenceMonth,
    players: selected,
    starters: selected.filter((player) => player.initialRole === "starter"),
    reserves: selected.filter((player) => player.initialRole === "reserve"),
    tiedGroups,
    boundaryTies,
    requiresLeadershipDecision: boundaryTies.length > 0,
    excludedPlayers: rankedPlayers.length - selected.length,
    playersBelowMinimum,
    minimumValidAttacks: MINIMUM_VALID_ATTACKS,
  };
}
