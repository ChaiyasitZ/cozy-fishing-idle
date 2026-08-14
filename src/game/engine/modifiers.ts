import { ITEM_BY_ID } from "@/game/data";
import type { GameState } from "@/game/types";

export interface Modifiers {
  bagCapacity: number;
  pondSlots: number;
  /** Additive luck: shifts bite weights toward rarer fish. */
  luck: number;
  /** Width of the timing zone as a fraction of the bar. */
  zoneWidth: number;
  /** <1 means the tension bar sweeps more slowly. */
  sweepMultiplier: number;
  sellMultiplier: number;
  sizeMultiplier: number;
  offlineCapMs: number;
  growthMultiplier: number;
  mutationChance: number;
  castCooldownMs: number;
  /** Time between deck-cat catches while away; Infinity without a cat. */
  autoCatchIntervalMs: number;
  /** Delay between casts when auto-fishing is on with the game open. */
  activeAutoCatchIntervalMs: number;
  blessing: number;
}

const HOUR = 3600_000;

export function lvl(state: GameState, id: string): number {
  return state.upgrades[id] ?? 0;
}

export function skill(state: GameState, id: string): number {
  return state.skills[id] ?? 0;
}

export function getModifiers(state: GameState): Modifiers {
  const blessing = state.prestige.blessing;
  const bait = state.equippedBaitId ? ITEM_BY_ID[state.equippedBaitId]?.bait : undefined;
  const helper = lvl(state, "helper");

  return {
    bagCapacity: 12 + lvl(state, "creel") * 4,
    pondSlots: 4 + lvl(state, "pond") * 2,
    luck: lvl(state, "charm") * 0.05 + skill(state, "luck") * 0.03 + blessing * 0.4,
    zoneWidth: Math.min(
      0.52,
      0.21 * (1 + lvl(state, "rod") * 0.06 + skill(state, "patience") * 0.05),
    ),
    sweepMultiplier: Math.max(0.58, 1 - lvl(state, "reel") * 0.04),
    sellMultiplier:
      (1 + lvl(state, "cooler") * 0.07 + skill(state, "merchant") * 0.06) * (1 + blessing),
    sizeMultiplier: 1 + lvl(state, "line") * 0.04 + (bait?.sizeBonus ?? 0),
    offlineCapMs: (2 + lvl(state, "rack") * 2 + skill(state, "dreamer") * 3) * HOUR,
    growthMultiplier: 1 + skill(state, "keeper") * 0.1 + blessing * 0.5,
    mutationChance: 0.008 + skill(state, "breeder") * 0.02 + blessing * 0.02,
    castCooldownMs: Math.max(420, 900 * (1 - skill(state, "swift") * 0.06)),
    autoCatchIntervalMs: helper > 0 ? 120_000 / (1 + (helper - 1) * 0.45) : Infinity,
    activeAutoCatchIntervalMs:
      helper > 0 ? Math.max(5_000, 12_000 / (1 + (helper - 1) * 0.1)) : Infinity,
    blessing,
  };
}

export function xpForLevel(level: number): number {
  return Math.round(70 * Math.pow(level, 1.6));
}

/** Applies xp, handling multiple level-ups, and returns how many happened. */
export function grantXp(state: GameState, amount: number): number {
  state.xp += Math.max(0, Math.round(amount));
  let levelUps = 0;
  while (state.xp >= xpForLevel(state.level)) {
    state.xp -= xpForLevel(state.level);
    state.level += 1;
    state.skillPoints += 1;
    levelUps += 1;
    if (levelUps > 200) break;
  }
  return levelUps;
}
