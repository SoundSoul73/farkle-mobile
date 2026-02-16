import { describe, expect, it } from "vitest";
import { scoreRoll } from "./scoring";

describe("scoreRoll", () => {
  it("scores a single 1", () => {
    const result = scoreRoll([1, 2, 3, 4, 6, 2]);
    expect(result.bestPoints).toBe(100);
    expect(result.bestUsedIndices).toEqual([0]);
    expect(result.farkle).toBe(false);
  });

  it("scores a single 5", () => {
    const result = scoreRoll([2, 5, 3, 4, 6, 2]);
    expect(result.bestPoints).toBe(50);
    expect(result.bestUsedIndices).toEqual([1]);
    expect(result.farkle).toBe(false);
  });

  it("scores mixed singles for 1s and 5s", () => {
    const result = scoreRoll([1, 5, 2, 4, 5, 6]);
    expect(result.bestPoints).toBe(200);
    expect(result.bestUsedIndices).toEqual([0, 1, 4]);
  });

  it("scores triple twos", () => {
    const result = scoreRoll([2, 2, 2, 3, 4, 6]);
    expect(result.bestPoints).toBe(200);
    expect(result.hotDice).toBe(false);
  });

  it("scores triple ones as 1000", () => {
    const result = scoreRoll([1, 1, 1, 2, 3, 4]);
    expect(result.bestPoints).toBe(1000);
  });

  it("adds singles to a triple when beneficial", () => {
    const result = scoreRoll([1, 1, 1, 5, 2, 4]);
    expect(result.bestPoints).toBe(1050);
    expect(result.bestUsedIndices).toEqual([0, 1, 2, 3]);
  });

  it("chooses triple ones over three single ones", () => {
    const result = scoreRoll([1, 1, 1, 2, 5, 6]);
    expect(result.bestPoints).toBe(1050);
  });

  it("scores a straight as 1500", () => {
    const result = scoreRoll([1, 2, 3, 4, 5, 6]);
    expect(result.bestPoints).toBe(1500);
    expect(result.hotDice).toBe(true);
    expect(result.lines.some((line) => line.label === "Straight (1-6)")).toBe(true);
  });

  it("scores three pairs as 1500", () => {
    const result = scoreRoll([1, 1, 2, 2, 3, 3]);
    expect(result.bestPoints).toBe(1500);
    expect(result.hotDice).toBe(true);
    expect(result.lines.some((line) => line.label === "Three pairs")).toBe(true);
  });

  it("scores two triplets as 2500", () => {
    const result = scoreRoll([2, 2, 2, 3, 3, 3]);
    expect(result.bestPoints).toBe(2500);
    expect(result.hotDice).toBe(true);
    expect(result.lines.some((line) => line.label === "Two triplets")).toBe(true);
  });

  it("scores four of a kind plus a pair as 1500", () => {
    const result = scoreRoll([4, 4, 4, 4, 2, 2]);
    expect(result.bestPoints).toBe(1500);
    expect(result.hotDice).toBe(true);
    expect(result.lines.some((line) => line.label === "Four of a kind + a pair")).toBe(true);
  });

  it("chooses straight over singles", () => {
    const result = scoreRoll([1, 2, 3, 4, 5, 6]);
    expect(result.bestPoints).toBe(1500);
  });

  it("chooses two triplets over lower-value alternatives", () => {
    const result = scoreRoll([1, 1, 1, 5, 5, 5]);
    expect(result.bestPoints).toBe(2500);
    expect(result.lines.some((line) => line.label === "Two triplets")).toBe(true);
  });

  it("returns farkle when no scoring dice", () => {
    const result = scoreRoll([2, 3, 4, 6, 2, 3]);
    expect(result.bestPoints).toBe(0);
    expect(result.farkle).toBe(true);
    expect(result.hotDice).toBe(false);
    expect(result.bestUsedIndices).toEqual([]);
  });

  it("marks hot dice when all dice contribute via mixed lines", () => {
    const result = scoreRoll([1, 1, 1, 5, 5, 5]);
    expect(result.hotDice).toBe(true);
    expect(result.bestUsedIndices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("does not mark hot dice when some dice are unused", () => {
    const result = scoreRoll([1, 1, 1, 2, 3, 4]);
    expect(result.hotDice).toBe(false);
  });
});
