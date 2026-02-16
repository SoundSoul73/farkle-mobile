import { scoreRoll, type ScoreEvaluation } from "./scoring";

export const FARKLE_SCHEMA_VERSION = 1;
export const DEFAULT_WIN_TARGET = 10000;

export type PlayerState = {
  name: string;
  totalScore: number;
};

export type GameSettings = {
  winTarget: number;
  exactWin: boolean;
};

export type GameState = {
  players: PlayerState[];
  activePlayerIndex: number;
  currentDice: Array<number | null>;
  selectedIndices: number[];
  turnSubtotal: number;
  availableDiceCount: number;
  lastRoll: number[];
  lastScoreEvaluation: ScoreEvaluation | null;
  settings: GameSettings;
  schema_version: number;
};

export type DiceRoller = (count: number) => number[];

export type GameAction =
  | { type: "SETUP"; players: string[] }
  | { type: "ROLL" }
  | { type: "TOGGLE_DIE"; index: number }
  | { type: "BANK" }
  | { type: "END_TURN" }
  | { type: "NEW_GAME" }
  | { type: "LOAD_SAVED"; state: GameState };

function defaultState(): GameState {
  return {
    players: [],
    activePlayerIndex: 0,
    currentDice: [null, null, null, null, null, null],
    selectedIndices: [],
    turnSubtotal: 0,
    availableDiceCount: 6,
    lastRoll: [],
    lastScoreEvaluation: null,
    settings: {
      winTarget: DEFAULT_WIN_TARGET,
      exactWin: false,
    },
    schema_version: FARKLE_SCHEMA_VERSION,
  };
}

function normalizePlayers(names: string[]): PlayerState[] {
  return names.slice(0, 6).map((name, index) => ({
    name: name.trim() || `Player ${index + 1}`,
    totalScore: 0,
  }));
}

function buildCurrentDice(roll: number[]): Array<number | null> {
  const out: Array<number | null> = [null, null, null, null, null, null];
  for (let i = 0; i < Math.min(6, roll.length); i += 1) {
    out[i] = roll[i];
  }
  return out;
}

function endTurn(state: GameState): GameState {
  if (state.players.length === 0) {
    return {
      ...state,
      turnSubtotal: 0,
      selectedIndices: [],
      availableDiceCount: 6,
      currentDice: [null, null, null, null, null, null],
      lastRoll: [],
      lastScoreEvaluation: null,
    };
  }

  return {
    ...state,
    activePlayerIndex: (state.activePlayerIndex + 1) % state.players.length,
    turnSubtotal: 0,
    selectedIndices: [],
    availableDiceCount: 6,
    currentDice: [null, null, null, null, null, null],
    lastRoll: [],
    lastScoreEvaluation: null,
  };
}

function selectedValues(state: GameState, indices: number[]): number[] {
  const values: number[] = [];
  for (const index of indices) {
    if (index < 0 || index >= state.lastRoll.length) return [];
    const die = state.currentDice[index];
    if (typeof die !== "number") return [];
    values.push(die);
  }
  return values;
}

function selectedScore(state: GameState, indices: number[]): number {
  if (indices.length === 0) return 0;

  const values = selectedValues(state, indices);
  if (values.length !== indices.length) return 0;

  const evaluation = scoreRoll(values);
  const usesAllSelected = evaluation.bestUsedIndices.length === indices.length;
  if (!usesAllSelected) return 0;
  return evaluation.bestPoints;
}

function commitSelectedIntoSubtotal(state: GameState): GameState {
  const points = selectedScore(state, state.selectedIndices);
  if (points <= 0) return state;
  return {
    ...state,
    turnSubtotal: state.turnSubtotal + points,
    selectedIndices: [],
  };
}

export function createInitialState(players: string[] = [], settings?: Partial<GameSettings>): GameState {
  const base = defaultState();
  const normalized = normalizePlayers(players);
  if (normalized.length > 6) {
    throw new Error("Game setup requires 1-6 players.");
  }
  return {
    ...base,
    players: normalized,
    settings: {
      winTarget: settings?.winTarget ?? base.settings.winTarget,
      exactWin: settings?.exactWin ?? base.settings.exactWin,
    },
  };
}

export function createGameReducer(roller: DiceRoller) {
  return function reduce(state: GameState = defaultState(), action: GameAction): GameState {
    switch (action.type) {
      case "SETUP": {
        const players = normalizePlayers(action.players);
        if (players.length < 1 || players.length > 6) return state;
        return {
          ...defaultState(),
          players,
          settings: state.settings,
        };
      }

      case "ROLL": {
        if (state.players.length === 0) return state;

        let working = state;
        if (state.lastRoll.length > 0) {
          const pendingPoints = selectedScore(state, state.selectedIndices);
          if (pendingPoints <= 0) return state;
          working = commitSelectedIntoSubtotal(state);
        }

        const diceToRoll = working.availableDiceCount === 0 ? 6 : working.availableDiceCount;
        const roll = roller(diceToRoll);
        if (roll.length !== diceToRoll) {
          throw new Error(`Roller returned ${roll.length} dice for requested ${diceToRoll}.`);
        }

        const evaluation = scoreRoll(roll);
        const rolledState: GameState = {
          ...working,
          currentDice: buildCurrentDice(roll),
          selectedIndices: [],
          lastRoll: roll,
          lastScoreEvaluation: evaluation,
          availableDiceCount: diceToRoll,
        };

        if (evaluation.farkle) {
          return endTurn({
            ...rolledState,
            turnSubtotal: 0,
          });
        }

        return rolledState;
      }

      case "TOGGLE_DIE": {
        if (state.lastRoll.length === 0) return state;
        if (action.index < 0 || action.index >= state.lastRoll.length) return state;

        const selected = new Set(state.selectedIndices);
        if (selected.has(action.index)) {
          selected.delete(action.index);
        } else {
          selected.add(action.index);
        }
        const nextIndices = Array.from(selected).sort((a, b) => a - b);

        if (nextIndices.length === 0) {
          return {
            ...state,
            selectedIndices: [],
            availableDiceCount: state.lastRoll.length,
          };
        }

        const nextScore = selectedScore(state, nextIndices);
        if (nextScore <= 0) return state;

        return {
          ...state,
          selectedIndices: nextIndices,
          availableDiceCount: state.lastRoll.length - nextIndices.length,
        };
      }

      case "BANK": {
        if (state.players.length === 0) return state;

        const pending = selectedScore(state, state.selectedIndices);
        const bankAmount = state.turnSubtotal + pending;
        const active = state.players[state.activePlayerIndex];
        const tentative = active.totalScore + bankAmount;
        const canApply =
          state.settings.exactWin === false || tentative <= state.settings.winTarget;
        const nextScore = canApply ? tentative : active.totalScore;

        const players = state.players.map((player, index) =>
          index === state.activePlayerIndex ? { ...player, totalScore: nextScore } : player,
        );

        return endTurn({
          ...state,
          players,
        });
      }

      case "END_TURN": {
        return endTurn(state);
      }

      case "NEW_GAME": {
        return {
          ...defaultState(),
          players: state.players.map((player) => ({
            ...player,
            totalScore: 0,
          })),
          settings: state.settings,
        };
      }

      case "LOAD_SAVED": {
        return {
          ...action.state,
          schema_version: FARKLE_SCHEMA_VERSION,
        };
      }

      default: {
        return state;
      }
    }
  };
}
