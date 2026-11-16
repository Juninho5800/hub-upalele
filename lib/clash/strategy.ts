
export type AttackType = "1" | "2";

export type StrategyMember = {
  tag: string;
  name: string;
  mapPosition: number;
  townhallLevel?: number;
  townHallLevel?: number;
};

export type StrategyTargetResult = {
  target: StrategyMember | null;
  reason: string;
  ruleReference: string | null;
};

export function normalizeTag(tag: string) {
  return tag.replace(/^#/, "").toUpperCase();
}

export function getTownHallLevel(member: StrategyMember) {
  return member.townhallLevel ?? member.townHallLevel;
}

export function getTarget(
  type: AttackType,
  player: StrategyMember,
  enemies: StrategyMember[],
  bestStarsByEnemy: Map<string, number>,
  alreadyAttackedTags: Set<string> = new Set()
): StrategyTargetResult {
  const alreadyAttacked = new Set(
    [...alreadyAttackedTags].map(normalizeTag)
  );

  const available = enemies.filter((enemy) => {
    const enemyTag = normalizeTag(enemy.tag);
    const bestStars = bestStarsByEnemy.get(enemyTag) ?? 0;

    return bestStars < 3 && !alreadyAttacked.has(enemyTag);
  });

  if (!available.length) {
    return {
      target: null,
      reason: "Não há alvos disponíveis que o jogador ainda não tenha atacado.",
      ruleReference: null,
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
        reason: "Alvo inicial: duas posições abaixo do espelho.",
        ruleReference: "Item 2.14",
      };
    }

    const below = available
      .filter((enemy) => enemy.mapPosition > initialPosition)
      .sort((a, b) => a.mapPosition - b.mapPosition);

    if (below.length) {
      return {
        target: below[0],
        reason: "Próximo alvo disponível abaixo no mapa.",
        ruleReference: "Itens 2.15 e 2.16",
      };
    }

    const above = available
      .filter((enemy) => enemy.mapPosition < initialPosition)
      .sort((a, b) => b.mapPosition - a.mapPosition);

    return {
      target: above[0] ?? null,
      reason: "Não há alvos disponíveis abaixo.",
      ruleReference: above.length ? "Item 2.17" : null,
    };
  }

  const playerCv = getTownHallLevel(player);

  if (playerCv == null) {
    return {
      target: null,
      reason: "Não foi possível identificar o CV do jogador.",
      ruleReference: null,
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

  const target = sameCv[0] ?? lowerCv[0] ?? higherCv[0] ?? null;

  if (!target) {
    return {
      target: null,
      reason: "Não foi possível encontrar um alvo com CV identificado.",
      ruleReference: null,
    };
  }

  return {
    target,
    reason:
      "Prioridade: CV igual, depois inferior e por último superior; de baixo para cima.",
    ruleReference:
      getTownHallLevel(target) === playerCv
        ? "Item 2.18"
        : (getTownHallLevel(target) ?? 0) < playerCv
          ? "Item 2.19"
          : "Item 2.20",
  };
}
