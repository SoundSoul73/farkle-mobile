export type ScoreLine = { points: number; label: string; usedIndices: number[] };

export type ScoreEvaluation = {
  bestPoints: number;
  bestUsedIndices: number[];
  lines: ScoreLine[];
  farkle: boolean;
  hotDice: boolean;
};

type InternalEvaluation = {
  points: number;
  usedIndices: number[];
  lines: ScoreLine[];
};

function sortedIndices(indices: number[]): number[] {
  return [...indices].sort((a, b) => a - b);
}

function countBits(mask: number): number {
  let count = 0;
  let value = mask;
  while (value > 0) {
    count += value & 1;
    value >>= 1;
  }
  return count;
}

function indicesByFaceFromMask(dice: number[], mask: number): Map<number, number[]> {
  const byFace = new Map<number, number[]>();
  for (let i = 0; i < dice.length; i += 1) {
    if ((mask & (1 << i)) === 0) continue;
    const face = dice[i];
    const current = byFace.get(face) ?? [];
    current.push(i);
    byFace.set(face, current);
  }
  return byFace;
}

function compareEvaluations(a: InternalEvaluation, b: InternalEvaluation): InternalEvaluation {
  if (a.points !== b.points) {
    return a.points > b.points ? a : b;
  }

  if (a.usedIndices.length !== b.usedIndices.length) {
    return a.usedIndices.length > b.usedIndices.length ? a : b;
  }

  const aSorted = sortedIndices(a.usedIndices);
  const bSorted = sortedIndices(b.usedIndices);
  for (let i = 0; i < Math.min(aSorted.length, bSorted.length); i += 1) {
    if (aSorted[i] !== bSorted[i]) {
      return aSorted[i] < bSorted[i] ? a : b;
    }
  }

  return a;
}

function collectMoves(dice: number[], mask: number): ScoreLine[] {
  const moves: ScoreLine[] = [];
  const byFace = indicesByFaceFromMask(dice, mask);

  // Singles: 1 and 5
  for (const [face, indices] of byFace.entries()) {
    if (face !== 1 && face !== 5) continue;
    const points = face === 1 ? 100 : 50;
    for (const index of indices) {
      moves.push({
        points,
        label: `Single ${face}`,
        usedIndices: [index],
      });
    }
  }

  // Three of a kind for any face with count >= 3
  for (const [face, indices] of byFace.entries()) {
    if (indices.length < 3) continue;
    moves.push({
      points: face === 1 ? 1000 : face * 100,
      label: face === 1 ? "Three 1s" : `Three ${face}s`,
      usedIndices: indices.slice(0, 3),
    });
  }

  // Six-dice special combos
  if (countBits(mask) === 6) {
    const faceCounts = Array.from(byFace.values()).map((idxs) => idxs.length).sort((a, b) => a - b);

    const isStraight = [1, 2, 3, 4, 5, 6].every((face) => (byFace.get(face)?.length ?? 0) === 1);
    if (isStraight) {
      const usedIndices = sortedIndices(Array.from(byFace.values()).flat());
      moves.push({
        points: 1500,
        label: "Straight (1-6)",
        usedIndices,
      });
    }

    const isThreePairs = faceCounts.length === 3 && faceCounts.every((count) => count === 2);
    if (isThreePairs) {
      const usedIndices = sortedIndices(Array.from(byFace.values()).flat());
      moves.push({
        points: 1500,
        label: "Three pairs",
        usedIndices,
      });
    }

    const isTwoTriplets = faceCounts.length === 2 && faceCounts.every((count) => count === 3);
    if (isTwoTriplets) {
      const usedIndices = sortedIndices(Array.from(byFace.values()).flat());
      moves.push({
        points: 2500,
        label: "Two triplets",
        usedIndices,
      });
    }

    const isFourPlusPair = faceCounts.length === 2 && faceCounts[0] === 2 && faceCounts[1] === 4;
    if (isFourPlusPair) {
      const usedIndices = sortedIndices(Array.from(byFace.values()).flat());
      moves.push({
        points: 1500,
        label: "Four of a kind + a pair",
        usedIndices,
      });
    }
  }

  return moves;
}

export function scoreRoll(dice: number[]): ScoreEvaluation {
  const fullMask = (1 << dice.length) - 1;
  const memo = new Map<number, InternalEvaluation>();

  function solve(mask: number): InternalEvaluation {
    const cached = memo.get(mask);
    if (cached) return cached;

    const moves = collectMoves(dice, mask);

    let best: InternalEvaluation = {
      points: 0,
      usedIndices: [],
      lines: [],
    };

    for (const move of moves) {
      const moveMask = move.usedIndices.reduce((acc, index) => acc | (1 << index), 0);
      const next = solve(mask & ~moveMask);

      const candidate: InternalEvaluation = {
        points: move.points + next.points,
        usedIndices: [...move.usedIndices, ...next.usedIndices],
        lines: [move, ...next.lines],
      };

      best = compareEvaluations(candidate, best);
    }

    memo.set(mask, best);
    return best;
  }

  const best = solve(fullMask);
  const bestUsedIndices = sortedIndices(best.usedIndices);

  return {
    bestPoints: best.points,
    bestUsedIndices,
    lines: best.lines,
    farkle: best.points === 0,
    hotDice: bestUsedIndices.length === dice.length,
  };
}
