"use client";

import { create } from "zustand";
import { SPECIES_BY_ID } from "@/game/data";
import {
  applyCommand,
  createInitialState,
  type Command,
  type CommandEffects,
} from "@/game/engine";
import type { CatchResult, GameState, IdleReport, PendingCast } from "@/game/types";
import { flushLocalState, saveLocalState } from "@/lib/save/local";
import { playCue } from "@/lib/sound";

export type Tab = "fish" | "pond" | "shop" | "dex" | "friends" | "more";
export type CastPhase = "idle" | "casting" | "hooked" | "reeling" | "reveal";

export interface Toast {
  id: number;
  emoji: string;
  text: string;
  tone: "good" | "bad" | "info";
}

export interface CloudTransport {
  run: (command: Command) => Promise<{ state: GameState; effects: CommandEffects }>;
}

interface GameStore {
  ready: boolean;
  mode: "guest" | "cloud";
  transport: CloudTransport | null;
  syncing: boolean;
  connectionError: boolean;
  /** True while a guest save is being uploaded after signing in. */
  migrating: boolean;
  /** True when another tab holds the guest save, so this tab plays read-only. */
  saveLocked: boolean;

  state: GameState;
  tab: Tab;

  phase: CastPhase;
  cast: PendingCast | null;
  /** performance.now() when the tension bar started, for tap timing. */
  barStartedAt: number;
  /** Session-only toggle; requires at least one Deck Cat upgrade. */
  autoFishing: boolean;
  lastResult: CatchResult | null;
  welcomeBack: IdleReport | null;

  selection: string[];
  breedSelection: string[];
  toasts: Toast[];

  init: (args: {
    mode: "guest" | "cloud";
    state: GameState;
    transport?: CloudTransport | null;
    idle?: IdleReport | null;
  }) => void;
  run: (command: Command) => Promise<CommandEffects>;
  /** Replaces state with one returned by a server action (trades, gifts, visits). */
  applyRemoteState: (state: GameState) => void;
  setMigrating: (migrating: boolean) => void;
  setSaveLocked: (locked: boolean) => void;
  doCast: () => Promise<void>;
  doTap: () => Promise<void>;
  setAutoFishing: (enabled: boolean) => void;
  setTab: (tab: Tab) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleBreedSelect: (id: string) => void;
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  dismissWelcome: () => void;
  clearResult: () => void;
}

let toastSeq = 0;
const CASTING_MS = 620;

export const useGame = create<GameStore>((set, get) => ({
  ready: false,
  mode: "guest",
  transport: null,
  syncing: false,
  connectionError: false,
  migrating: false,
  saveLocked: false,

  state: createInitialState(),
  tab: "fish",

  phase: "idle",
  cast: null,
  barStartedAt: 0,
  autoFishing: false,
  lastResult: null,
  welcomeBack: null,

  selection: [],
  breedSelection: [],
  toasts: [],

  init: ({ mode, state, transport = null, idle = null }) => {
    set({
      ready: true,
      mode,
      state,
      transport,
      welcomeBack: idle && (idle.caught.length > 0 || idle.autoSoldCount > 0 || idle.pondCoins > 0) ? idle : null,
      phase: state.pendingCast ? "idle" : "idle",
    });
  },

  run: async (command) => {
    const { mode, transport, state } = get();

    if (mode === "cloud" && transport) {
      set({ syncing: true });
      try {
        const result = await transport.run(command);
        set({ state: result.state, syncing: false, connectionError: false });
        announce(result.effects, result.state, get().pushToast);
        return result.effects;
      } catch {
        set({ syncing: false, connectionError: true });
        return { ok: false, error: "network" };
      }
    }

    const { state: next, effects } = applyCommand(state, command);
    set({ state: next });
    saveLocalState(next);
    announce(effects, next, get().pushToast);
    return effects;
  },

  applyRemoteState: (state) => set({ state }),
  setMigrating: (migrating) => set({ migrating }),
  setSaveLocked: (saveLocked) => set({ saveLocked }),

  doCast: async () => {
    const { phase, state, run } = get();
    if (phase !== "idle") return;

    playCue("cast", state.settings.sound);
    set({ phase: "casting", lastResult: null });

    const effects = await run({ type: "cast" });
    const cast = get().state.pendingCast;
    if (!effects.ok || !cast) {
      set({ phase: "idle" });
      return;
    }

    // Let the bobber fly before the tension bar takes over.
    const remaining = Math.max(0, CASTING_MS - 0);
    await new Promise((resolve) => setTimeout(resolve, remaining));
    if (get().phase !== "casting") return;

    playCue("bite", get().state.settings.sound);
    set({ phase: "hooked", cast, barStartedAt: performance.now() });

    const timeout = cast.timeoutMs;
    window.setTimeout(() => {
      if (get().phase === "hooked" && get().cast?.id === cast.id) void get().doTap();
    }, timeout + 60);
  },

  doTap: async () => {
    const { phase, cast, barStartedAt, state, run } = get();
    if (phase !== "hooked" || !cast) return;

    const elapsed = performance.now() - barStartedAt;
    const tapAtMs = elapsed >= cast.timeoutMs ? null : Math.round(elapsed);
    if (tapAtMs !== null) playCue("tap", state.settings.sound);
    set({ phase: "reeling" });

    const effects = await run({ type: "resolveCast", tapAtMs });
    const result = effects.catchResult ?? null;
    set({ phase: "reveal", lastResult: result, cast: null });

    const sound = get().state.settings.sound;
    if (result?.outcome === "fish" && result.fish) {
      const rarity = SPECIES_BY_ID[result.fish.speciesId]?.rarity;
      const isBig = rarity === "legendary" || rarity === "mythic" || !!result.fish.mutation;
      playCue(isBig ? "big" : "catch", sound);
    } else if (result?.outcome === "junk") {
      playCue("coin", sound);
    } else {
      playCue("miss", sound);
    }

    window.setTimeout(() => {
      if (get().phase === "reveal") set({ phase: "idle" });
    }, result?.outcome === "fish" ? 1500 : 1000);
  },

  setAutoFishing: (autoFishing) => {
    const unlocked = (get().state.upgrades.helper ?? 0) > 0;
    set({ autoFishing: unlocked && autoFishing });
  },

  setTab: (tab) => set({ tab, selection: [], breedSelection: [] }),

  toggleSelect: (id) =>
    set((s) => ({
      selection: s.selection.includes(id)
        ? s.selection.filter((x) => x !== id)
        : [...s.selection, id],
    })),

  selectAll: () => set((s) => ({ selection: s.state.bag.map((f) => f.id) })),
  clearSelection: () => set({ selection: [] }),

  toggleBreedSelect: (id) =>
    set((s) => {
      if (s.breedSelection.includes(id)) {
        return { breedSelection: s.breedSelection.filter((x) => x !== id) };
      }
      return { breedSelection: [...s.breedSelection, id].slice(-2) };
    }),

  pushToast: (toast) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }].slice(-4) }));
    window.setTimeout(() => get().dismissToast(id), 2600);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  dismissWelcome: () => set({ welcomeBack: null }),
  clearResult: () => set({ lastResult: null }),
}));

/** Turns command effects into the little floating messages players actually read. */
function announce(
  effects: CommandEffects,
  state: GameState,
  push: (toast: Omit<Toast, "id">) => void,
) {
  const locale = state.settings.locale;
  if (effects.coins && effects.coins > 0 && !effects.catchResult) {
    push({
      emoji: "🪙",
      tone: "good",
      text: locale === "th" ? `+${effects.coins} เหรียญ` : `+${effects.coins} coins`,
    });
  }
  if (effects.pearls && effects.pearls > 0) {
    push({
      emoji: "🫧",
      tone: "good",
      text: locale === "th" ? `+${effects.pearls} ไข่มุก` : `+${effects.pearls} pearls`,
    });
  }
  if (effects.levelUps && effects.levelUps > 0) {
    playCue("level", state.settings.sound);
    push({
      emoji: "⬆️",
      tone: "good",
      text:
        locale === "th"
          ? `เลเวลอัพ! ตอนนี้เลเวล ${state.level}`
          : `Level up! Now level ${state.level}`,
    });
  }
  for (const id of effects.achievements ?? []) {
    push({
      emoji: "🏅",
      tone: "good",
      text: locale === "th" ? "ปลดล็อกรางวัลใหม่" : "Achievement unlocked",
    });
    void id;
  }
  if (!effects.ok && effects.error && effects.error !== "cooldown" && effects.error !== "pending") {
    const messages: Record<string, { th: string; en: string }> = {
      cannot_afford: { th: "เหรียญไม่พอ", en: "Not enough coins" },
      pond_full: { th: "บ่อเต็มแล้ว", en: "The pond is full" },
      bag_full: { th: "กระเป๋าเต็ม", en: "Your creel is full" },
      no_food: { th: "ไม่มีอาหารปลา", en: "No fish food" },
      no_bait: { th: "ไม่มีเหยื่อชนิดนี้", en: "You don't have that bait" },
      species: { th: "ต้องเป็นปลาสายพันธุ์เดียวกันที่ผสมพันธุ์ได้", en: "Needs two breedable fish of one species" },
      immature: { th: "ปลายังไม่โตเต็มวัย", en: "Those fish aren't mature yet" },
      cooldown: { th: "ยังพักฟื้นอยู่", en: "Still resting" },
      slots: { th: "บ่อไม่มีที่ว่างให้ลูกปลา", en: "No pond space for the fry" },
      food: { th: "ต้องมีอาหารปลาก่อน", en: "You need fish food" },
      network: { th: "เชื่อมต่อไม่ได้ ลองอีกครั้ง", en: "Connection failed — try again" },
      not_eligible: { th: "ยังไม่ถึงเงื่อนไข", en: "Not eligible yet" },
    };
    const message = messages[effects.error];
    if (message) push({ emoji: "⚠️", tone: "bad", text: message[locale] });
  }
}

/** Called on unload so nothing is lost between the debounce window. */
export function flushGuestSave() {
  const { mode, state } = useGame.getState();
  if (mode === "guest") flushLocalState(state);
}
