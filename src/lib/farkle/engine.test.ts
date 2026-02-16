import { describe, expect, it } from "vitest";
import { createGameReducer, createInitialState, type DiceRoller, type GameState } from "./engine";

function scriptedRoller(rolls: number[][]): { roller: DiceRoller; calls: number[] } {
  let cursor = 0;
  const calls: number[] = [];
  return {
    calls,
    roller: (count: number) => {
      calls.push(count);
      const next = rolls[cursor];
      if (!next) {
        throw new Error(`No scripted roll at index ${cursor}.`);
      }
      cursor += 1;
      return next;
    },
  };
}

function setupTwoPlayerState(): GameState {
  return createInitialState(["Alice", "Bob"]);
}

describe("farkle engine reducer", () => {
  it("farkle roll resets subtotal and automatically ends the turn", () => {
    const { roller, calls } = scriptedRoller([[2, 3, 4, 6, 2, 3]]);
    const reduce = createGameReducer(roller);

    const start = setupTwoPlayerState();
    const afterRoll = reduce(start, { type: "ROLL" });

    expect(calls).toEqual([6]);
    expect(afterRoll.activePlayerIndex).toBe(1);
    expect(afterRoll.turnSubtotal).toBe(0);
    expect(afterRoll.availableDiceCount).toBe(6);
    expect(afterRoll.lastRoll).toEqual([]);
    expect(afterRoll.selectedIndices).toEqual([]);
  });

  it("hot dice selection sets available dice to 0 and next roll resets to 6 dice", () => {
    const { roller, calls } = scriptedRoller([
      [1, 1, 1, 5, 5, 5],
      [2, 2, 2, 3, 4, 6],
    ]);
    const reduce = createGameReducer(roller);

    let state = setupTwoPlayerState();
    state = reduce(state, { type: "ROLL" });
    for (let i = 0; i < 6; i += 1) {
      state = reduce(state, { type: "TOGGLE_DIE", index: i });
    }

    expect(state.availableDiceCount).toBe(0);
    expect(state.selectedIndices).toEqual([0, 1, 2, 3, 4, 5]);

    state = reduce(state, { type: "ROLL" });

    expect(calls).toEqual([6, 6]);
    expect(state.turnSubtotal).toBe(2500);
    expect(state.lastRoll).toEqual([2, 2, 2, 3, 4, 6]);
    expect(state.activePlayerIndex).toBe(0);
  });

  it("bank adds turn points to the active player and ends turn", () => {
    const { roller } = scriptedRoller([[1, 1, 1, 2, 3, 4]]);
    const reduce = createGameReducer(roller);

    let state = setupTwoPlayerState();
    state = reduce(state, { type: "ROLL" });
    state = reduce(state, { type: "TOGGLE_DIE", index: 0 });
    state = reduce(state, { type: "TOGGLE_DIE", index: 1 });
    state = reduce(state, { type: "TOGGLE_DIE", index: 2 });
    state = reduce(state, { type: "BANK" });

    expect(state.players[0].totalScore).toBe(1000);
    expect(state.players[1].totalScore).toBe(0);
    expect(state.activePlayerIndex).toBe(1);
    expect(state.turnSubtotal).toBe(0);
    expect(state.availableDiceCount).toBe(6);
    expect(state.lastRoll).toEqual([]);
    expect(state.selectedIndices).toEqual([]);
  });
});
