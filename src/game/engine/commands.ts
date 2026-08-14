import type {
  CatchResult,
  GameSettings,
  GameState,
  IdleReport,
  SkillId,
  UpgradeId,
  ZoneId,
} from "@/game/types";
import { checkAchievements } from "./achievements";
import { resolveCast, startCast } from "./catch";
import {
  buyItem,
  buyUpgrade,
  sellFish,
  sellMaterials,
  spendSkillPoint,
  travelTo,
  unlockZone,
} from "./economy";
import { resolveIdle } from "./idle";
import {
  breedFish,
  collectPond,
  feedPond,
  moveToBag,
  sellPondFish,
  stockFish,
} from "./pond";
import { prestige } from "./prestige";
import { claimQuest } from "./quests";
import { clone } from "./state";

export type Command =
  | { type: "tick" }
  | { type: "cast" }
  | { type: "resolveCast"; tapAtMs: number | null }
  | { type: "sellFish"; ids: string[] }
  | { type: "sellMaterials" }
  | { type: "buyItem"; itemId: string; qty: number }
  | { type: "equipBait"; itemId: string | null }
  | { type: "buyUpgrade"; id: UpgradeId }
  | { type: "learnSkill"; id: SkillId }
  | { type: "travel"; zoneId: ZoneId }
  | { type: "unlockZone"; zoneId: ZoneId }
  | { type: "stockFish"; ids: string[] }
  | { type: "feedPond"; foodId: string }
  | { type: "collectPond" }
  | { type: "sellPondFish"; fishId: string }
  | { type: "pondToBag"; fishId: string }
  | { type: "breed"; aId: string; bId: string }
  | { type: "claimQuest"; questId: string }
  | { type: "prestige" }
  | { type: "updateSettings"; patch: Partial<GameSettings> };

export interface CommandEffects {
  ok: boolean;
  error?: string;
  catchResult?: CatchResult;
  idle?: IdleReport;
  coins?: number;
  pearls?: number;
  count?: number;
  achievements?: string[];
  levelUps?: number;
}

export interface CommandOutcome {
  state: GameState;
  effects: CommandEffects;
}

/** Idle progress worth telling the player about. */
const IDLE_REPORT_THRESHOLD_MS = 60_000;

/**
 * The only way game state ever changes. Pure: same input, same output. Runs in
 * the browser for guests and inside a Server Action for signed-in players.
 */
export function applyCommand(
  input: GameState,
  command: Command,
  now = Date.now(),
): CommandOutcome {
  let state = clone(input);
  const effects: CommandEffects = { ok: true };

  // Time always moves first, so no action can be used to dodge offline rules.
  const idle = resolveIdle(state, now);
  state = idle.state;
  const idleWorthReporting =
    idle.report.elapsedMs >= IDLE_REPORT_THRESHOLD_MS &&
    (idle.report.caught.length > 0 ||
      idle.report.autoSoldCount > 0 ||
      idle.report.pondCoins > 0);
  if (idleWorthReporting) effects.idle = idle.report;

  switch (command.type) {
    case "tick":
      break;

    case "cast": {
      const result = startCast(state, now);
      state = result.state;
      if (!result.cast) {
        effects.ok = false;
        effects.error = result.error;
      }
      break;
    }

    case "resolveCast": {
      const result = resolveCast(state, command.tapAtMs, now);
      state = result.state;
      effects.catchResult = result.result;
      effects.levelUps = result.result.levelUps;
      break;
    }

    case "sellFish": {
      const result = sellFish(state, command.ids, now);
      state = result.state;
      effects.coins = result.coins;
      effects.count = result.count;
      effects.ok = result.count > 0;
      break;
    }

    case "sellMaterials": {
      const result = sellMaterials(state, now);
      state = result.state;
      effects.coins = result.coins;
      effects.ok = result.coins > 0;
      break;
    }

    case "buyItem": {
      const result = buyItem(state, command.itemId, command.qty, now);
      state = result.state;
      effects.ok = result.ok;
      if (!result.ok) effects.error = "cannot_afford";
      break;
    }

    case "equipBait": {
      if (command.itemId === null || state.items[command.itemId] !== undefined) {
        state.equippedBaitId = command.itemId;
      } else {
        effects.ok = false;
        effects.error = "no_bait";
      }
      break;
    }

    case "buyUpgrade": {
      const result = buyUpgrade(state, command.id, now);
      state = result.state;
      effects.ok = result.ok;
      if (!result.ok) effects.error = "cannot_afford";
      break;
    }

    case "learnSkill": {
      const result = spendSkillPoint(state, command.id, now);
      state = result.state;
      effects.ok = result.ok;
      break;
    }

    case "travel": {
      const result = travelTo(state, command.zoneId);
      state = result.state;
      effects.ok = result.ok;
      break;
    }

    case "unlockZone": {
      const result = unlockZone(state, command.zoneId, now);
      state = result.state;
      effects.ok = result.ok;
      break;
    }

    case "stockFish": {
      const result = stockFish(state, command.ids, now);
      state = result.state;
      effects.count = result.moved;
      effects.ok = result.moved > 0;
      if (!result.moved) effects.error = "pond_full";
      break;
    }

    case "feedPond": {
      const result = feedPond(state, command.foodId, now);
      state = result.state;
      effects.ok = result.ok;
      if (!result.ok) effects.error = "no_food";
      break;
    }

    case "collectPond": {
      const result = collectPond(state, now);
      state = result.state;
      effects.coins = result.coins;
      effects.pearls = result.pearls;
      effects.ok = result.coins > 0 || result.pearls > 0;
      break;
    }

    case "sellPondFish": {
      const result = sellPondFish(state, command.fishId, now);
      state = result.state;
      effects.coins = result.coins;
      effects.ok = result.coins > 0;
      break;
    }

    case "pondToBag": {
      const result = moveToBag(state, command.fishId, now);
      state = result.state;
      effects.ok = result.ok;
      if (!result.ok) effects.error = "bag_full";
      break;
    }

    case "breed": {
      const result = breedFish(state, command.aId, command.bId, now);
      state = result.state;
      effects.ok = result.ok;
      if (!result.ok) effects.error = result.reason;
      break;
    }

    case "claimQuest": {
      const result = claimQuest(state, command.questId, now);
      effects.ok = result.ok;
      effects.coins = result.coins;
      effects.pearls = result.pearls;
      effects.levelUps = (effects.levelUps ?? 0) + result.levelUps;
      break;
    }

    case "prestige": {
      const result = prestige(state, now);
      state = result.state;
      effects.ok = result.ok;
      if (!result.ok) effects.error = "not_eligible";
      break;
    }

    case "updateSettings": {
      state.settings = { ...state.settings, ...command.patch };
      break;
    }
  }

  const unlocked = checkAchievements(state, now);
  if (unlocked.length > 0) effects.achievements = unlocked.map((a) => a.id);

  return { state, effects };
}

/**
 * Hides the pre-rolled catch before sending state to the browser. Without this
 * a player could peek at the pending fish and only bother reeling in good ones.
 */
export function sanitizeForClient(state: GameState): GameState {
  if (!state.pendingCast) return state;
  return {
    ...state,
    pendingCast: { ...state.pendingCast, fish: null, junkItemId: null },
  };
}
