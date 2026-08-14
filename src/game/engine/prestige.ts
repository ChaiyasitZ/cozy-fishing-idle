import type { GameState } from "@/game/types";
import { grantAchievement } from "./achievements";
import { addLog } from "./log";
import { createInitialState } from "./state";

export const PRESTIGE_MIN_LEVEL = 20;
/** Each release grants a permanent multiplier to income and luck. */
export const BLESSING_PER_PRESTIGE = 0.15;

export function prestigeInfo(state: GameState) {
  const eligible = state.level >= PRESTIGE_MIN_LEVEL;
  const dexBonus = Object.keys(state.fishdex).length * 0.002;
  const gain = BLESSING_PER_PRESTIGE + dexBonus;
  return {
    eligible,
    minLevel: PRESTIGE_MIN_LEVEL,
    currentBlessing: state.prestige.blessing,
    nextBlessing: state.prestige.blessing + gain,
    gain,
    count: state.prestige.count,
  };
}

/**
 * "ปล่อยปลากลับทะเล" — reset progression, keep the collection. Fishdex,
 * achievements, pearls and settings carry over; coins, gear and fish do not.
 */
export function prestige(
  state: GameState,
  now = Date.now(),
): { state: GameState; ok: boolean } {
  const info = prestigeInfo(state);
  if (!info.eligible) return { state, ok: false };

  const fresh = createInitialState(now, state.settings.locale);
  fresh.settings = { ...state.settings };
  fresh.fishdex = state.fishdex;
  fresh.achievements = [...state.achievements];
  fresh.pearls = state.pearls;
  fresh.stats = { ...state.stats };
  fresh.prestige = {
    count: state.prestige.count + 1,
    blessing: Math.round(info.nextBlessing * 1000) / 1000,
  };
  fresh.rngSeed = state.rngSeed;
  fresh.log = [];

  addLog(
    fresh,
    "system",
    `ปล่อยปลากลับทะเลครั้งที่ ${fresh.prestige.count} — ได้พรจากทะเล +${Math.round(
      fresh.prestige.blessing * 100,
    )}%`,
    `Released everything to the sea (#${fresh.prestige.count}) — Sea Blessing +${Math.round(
      fresh.prestige.blessing * 100,
    )}%`,
    now,
  );
  grantAchievement(fresh, "prestige_1", now);
  return { state: fresh, ok: true };
}
