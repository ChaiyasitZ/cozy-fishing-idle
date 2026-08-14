import {
  ITEM_BY_ID,
  MUTATION_INFO,
  SKILL_BY_ID,
  SPECIES_BY_ID,
  UPGRADE_BY_ID,
  upgradeCost,
  ZONE_BY_ID,
  ZONES,
} from "@/game/data";
import type {
  FishInstance,
  GameState,
  SkillId,
  UpgradeId,
  ZoneId,
} from "@/game/types";
import { addLog } from "./log";
import { getModifiers, lvl } from "./modifiers";
import { trackQuest } from "./quests";
import { dailyMerchant } from "./world";

const STAR_MULTIPLIER = [1, 1.35, 1.9, 2.8, 4.5];

/** Value of a single fish, before the merchant's daily bonus. */
export function fishValue(state: GameState, fish: FishInstance, now = Date.now()): number {
  const species = SPECIES_BY_ID[fish.speciesId];
  if (!species) return 0;
  const mods = getModifiers(state);
  const [min, max] = species.size;
  const sizeFactor = 0.6 + 0.9 * ((fish.sizeCm - min) / Math.max(1, max - min));
  const star = STAR_MULTIPLIER[Math.min(4, Math.max(0, fish.stars - 1))];
  const mutation = fish.mutation ? MUTATION_INFO[fish.mutation].multiplier : 1;
  const zone = ZONE_BY_ID[fish.zoneId] ?? ZONE_BY_ID.pond;

  const merchant = dailyMerchant(now);
  const bonus = merchant.bonusZoneId === fish.zoneId ? merchant.bonusMultiplier : 1;

  return Math.max(
    1,
    Math.round(
      species.basePrice *
        sizeFactor *
        star *
        mutation *
        zone.valueMultiplier *
        mods.sellMultiplier *
        bonus,
    ),
  );
}

export function sellFish(
  state: GameState,
  fishIds: string[],
  now = Date.now(),
): { state: GameState; coins: number; count: number } {
  const ids = new Set(fishIds);
  let coins = 0;
  let count = 0;

  state.bag = state.bag.filter((fish) => {
    if (!ids.has(fish.id)) return true;
    coins += fishValue(state, fish, now);
    count += 1;
    return false;
  });

  if (count > 0) {
    state.coins += coins;
    state.stats.coinsEarned += coins;
    state.stats.totalSold += count;
    trackQuest(state, "sell", count);
    trackQuest(state, "coins", coins);
    addLog(state, "sell", `ขายปลา ${count} ตัว +${coins} เหรียญ`, `Sold ${count} fish for ${coins} coins.`, now);
  }
  return { state, coins, count };
}

export function sellMaterials(
  state: GameState,
  now = Date.now(),
): { state: GameState; coins: number } {
  let coins = 0;
  for (const [itemId, qty] of Object.entries(state.items)) {
    const item = ITEM_BY_ID[itemId];
    if (!item || item.kind !== "material" || qty <= 0) continue;
    coins += item.sell * qty;
    delete state.items[itemId];
  }
  if (coins > 0) {
    state.coins += coins;
    state.stats.coinsEarned += coins;
    trackQuest(state, "coins", coins);
    addLog(state, "sell", `ขายของเก็บได้ +${coins} เหรียญ`, `Sold salvage for ${coins} coins.`, now);
  }
  return { state, coins };
}

export function itemPrice(itemId: string, now = Date.now()): number | null {
  const item = ITEM_BY_ID[itemId];
  if (!item || item.buy === null) return null;
  const merchant = dailyMerchant(now);
  if (merchant.discountBaitId === itemId) {
    return Math.max(1, Math.round(item.buy * (1 - merchant.discount)));
  }
  return item.buy;
}

export function buyItem(
  state: GameState,
  itemId: string,
  qty: number,
  now = Date.now(),
): { state: GameState; ok: boolean; spent: number } {
  const price = itemPrice(itemId, now);
  const amount = Math.max(1, Math.floor(qty));
  if (price === null) return { state, ok: false, spent: 0 };
  const spent = price * amount;
  if (state.coins < spent) return { state, ok: false, spent: 0 };

  state.coins -= spent;
  state.items[itemId] = (state.items[itemId] ?? 0) + amount;
  const item = ITEM_BY_ID[itemId];
  if (item.kind === "bait" && !state.equippedBaitId) state.equippedBaitId = itemId;
  addLog(state, "upgrade", `ซื้อ${item.name.th} x${amount}`, `Bought ${item.name.en} x${amount}`, now);
  return { state, ok: true, spent };
}

export function buyUpgrade(
  state: GameState,
  id: UpgradeId,
  now = Date.now(),
): { state: GameState; ok: boolean; spent: number } {
  const upgrade = UPGRADE_BY_ID[id];
  const level = lvl(state, id);
  if (!upgrade || level >= upgrade.maxLevel) return { state, ok: false, spent: 0 };
  const cost = upgradeCost(id, level);
  if (state.coins < cost) return { state, ok: false, spent: 0 };

  state.coins -= cost;
  state.upgrades[id] = level + 1;
  addLog(
    state,
    "upgrade",
    `อัพเกรด${upgrade.name.th} เป็นระดับ ${level + 1}`,
    `${upgrade.name.en} upgraded to level ${level + 1}.`,
    now,
  );
  return { state, ok: true, spent: cost };
}

export function spendSkillPoint(
  state: GameState,
  id: SkillId,
  now = Date.now(),
): { state: GameState; ok: boolean } {
  const skill = SKILL_BY_ID[id];
  const level = state.skills[id] ?? 0;
  if (!skill || state.skillPoints <= 0 || level >= skill.maxLevel) {
    return { state, ok: false };
  }
  state.skillPoints -= 1;
  state.skills[id] = level + 1;
  addLog(
    state,
    "upgrade",
    `เรียนสกิล ${skill.name.th} ระดับ ${level + 1}`,
    `Learned ${skill.name.en} level ${level + 1}.`,
    now,
  );
  return { state, ok: true };
}

export function zoneUnlockState(state: GameState, zoneId: ZoneId) {
  const zone = ZONE_BY_ID[zoneId];
  const unlocked = state.unlockedZones.includes(zoneId);
  const boat = lvl(state, "boat");
  return {
    zone,
    unlocked,
    meetsLevel: state.level >= zone.unlock.level,
    meetsBoat: boat >= zone.unlock.boatLevel,
    meetsCoins: state.coins >= zone.unlock.coins,
    canUnlock:
      !unlocked &&
      state.level >= zone.unlock.level &&
      boat >= zone.unlock.boatLevel &&
      state.coins >= zone.unlock.coins,
  };
}

export function unlockZone(
  state: GameState,
  zoneId: ZoneId,
  now = Date.now(),
): { state: GameState; ok: boolean } {
  const info = zoneUnlockState(state, zoneId);
  if (!info.canUnlock) return { state, ok: false };
  state.coins -= info.zone.unlock.coins;
  state.unlockedZones.push(zoneId);
  state.zoneId = zoneId;
  addLog(
    state,
    "system",
    `ปลดล็อก${info.zone.name.th}แล้ว!`,
    `Unlocked ${info.zone.name.en}!`,
    now,
  );
  return { state, ok: true };
}

export function travelTo(
  state: GameState,
  zoneId: ZoneId,
): { state: GameState; ok: boolean } {
  if (!state.unlockedZones.includes(zoneId)) return { state, ok: false };
  state.zoneId = zoneId;
  state.pendingCast = null;
  return { state, ok: true };
}

export const ALL_ZONES = ZONES;
