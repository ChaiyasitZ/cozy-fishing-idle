import {
  DAILY_QUESTS,
  DAILY_SLOTS,
  QUEST_BY_ID,
  WEEKLY_QUESTS,
} from "@/game/data";
import type { GameState, QuestMetric, QuestState } from "@/game/types";
import { addLog } from "./log";
import { grantXp } from "./modifiers";
import { createRng, hashString } from "./rng";
import { dailyKey, weeklyKey } from "./world";

/** Which dailies are live today is derived from the date, so it needs no cron. */
export function rollDailyQuests(key: string): QuestState[] {
  const rng = createRng(hashString(`q:${key}`));
  const pool = [...DAILY_QUESTS];
  const picked: QuestState[] = [];
  for (let i = 0; i < DAILY_SLOTS && pool.length > 0; i++) {
    const idx = rng.int(pool.length);
    picked.push({ id: pool[idx].id, progress: 0, claimed: false });
    pool.splice(idx, 1);
  }
  return picked;
}

export function rollWeeklyQuests(): QuestState[] {
  return WEEKLY_QUESTS.map((q) => ({ id: q.id, progress: 0, claimed: false }));
}

/** Rotates quest lists when the day or week changed. Safe to call often. */
export function refreshQuests(state: GameState, now: number): boolean {
  const dKey = dailyKey(now);
  const wKey = weeklyKey(now);
  let changed = false;

  if (state.quests.dailyKey !== dKey) {
    state.quests.dailyKey = dKey;
    state.quests.daily = rollDailyQuests(dKey);
    changed = true;
  }
  if (state.quests.weeklyKey !== wKey) {
    state.quests.weeklyKey = wKey;
    state.quests.weekly = rollWeeklyQuests();
    changed = true;
  }
  return changed;
}

export function trackQuest(state: GameState, metric: QuestMetric, amount = 1): void {
  if (amount <= 0) return;
  for (const list of [state.quests.daily, state.quests.weekly]) {
    for (const entry of list) {
      const quest = QUEST_BY_ID[entry.id];
      if (!quest || quest.metric !== metric || entry.claimed) continue;
      entry.progress = Math.min(quest.target, entry.progress + amount);
    }
  }
}

export function isQuestComplete(entry: QuestState): boolean {
  const quest = QUEST_BY_ID[entry.id];
  return !!quest && entry.progress >= quest.target;
}

export interface ClaimResult {
  ok: boolean;
  coins: number;
  xp: number;
  pearls: number;
  levelUps: number;
}

export function claimQuest(state: GameState, questId: string, now: number): ClaimResult {
  const entry =
    state.quests.daily.find((q) => q.id === questId) ??
    state.quests.weekly.find((q) => q.id === questId);
  const quest = QUEST_BY_ID[questId];
  const empty: ClaimResult = { ok: false, coins: 0, xp: 0, pearls: 0, levelUps: 0 };
  if (!entry || !quest || entry.claimed || !isQuestComplete(entry)) return empty;

  entry.claimed = true;
  state.coins += quest.reward.coins;
  state.pearls += quest.reward.pearls ?? 0;
  const levelUps = grantXp(state, quest.reward.xp);
  if (quest.reward.item) {
    const { id, qty } = quest.reward.item;
    state.items[id] = (state.items[id] ?? 0) + qty;
  }
  if (quest.period === "daily") {
    state.stats.dailiesCompleted += 1;
    trackQuest(state, "dailyDone", 1);
  }
  addLog(
    state,
    "quest",
    `เควสสำเร็จ: ${quest.name.th} (+${quest.reward.coins} เหรียญ)`,
    `Quest done: ${quest.name.en} (+${quest.reward.coins} coins)`,
    now,
  );
  return { ok: true, coins: quest.reward.coins, xp: quest.reward.xp, pearls: quest.reward.pearls ?? 0, levelUps };
}
