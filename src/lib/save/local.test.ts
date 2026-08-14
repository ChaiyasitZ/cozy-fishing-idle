import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "@/game/engine";
import type { GameState } from "@/game/types";

/** Minimal localStorage, shared by the simulated tabs like a real browser does. */
function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    get size() {
      return map.size;
    },
  };
}

const SAVE = "cozy-fishing-idle:save";
const LEASE = "cozy-fishing-idle:writer";

let storage: ReturnType<typeof makeStorage>;

/** Each import is a separate tab: the module's tab id is created on load. */
async function openTab() {
  vi.resetModules();
  return import("./local");
}

beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal("window", { localStorage: storage });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stateWith(coins: number, lastTickAt: number): GameState {
  const state = createInitialState(lastTickAt);
  state.coins = coins;
  state.lastTickAt = lastTickAt;
  return state;
}

describe("guest save", () => {
  it("round-trips through storage", async () => {
    const tab = await openTab();
    expect(tab.claimSave()).toBe(true);

    tab.flushLocalState(stateWith(777, 1000));
    const loaded = tab.loadLocalState();
    expect(loaded?.coins).toBe(777);
  });

  it("debounces writes and flushes immediately when asked", async () => {
    const tab = await openTab();
    tab.claimSave();

    tab.saveLocalState(stateWith(10, 1000));
    expect(storage.getItem(SAVE)).toBeNull();
    vi.advanceTimersByTime(500);
    expect(tab.loadLocalState()?.coins).toBe(10);

    tab.saveLocalState(stateWith(20, 2000));
    tab.flushLocalState(stateWith(30, 3000));
    vi.advanceTimersByTime(500);
    // The pending debounced write must not resurrect the older state.
    expect(tab.loadLocalState()?.coins).toBe(30);
  });

  it("survives a corrupt save instead of throwing", async () => {
    const tab = await openTab();
    storage.setItem(SAVE, "{not json");
    expect(tab.loadLocalState()).toBeNull();
  });
});

describe("save lease", () => {
  it("stops a second tab from writing over the first", async () => {
    const first = await openTab();
    expect(first.claimSave(1_000)).toBe(true);
    first.flushLocalState(stateWith(500, 1_000));

    const second = await openTab();
    expect(second.claimSave(2_000)).toBe(false);

    second.flushLocalState(stateWith(1, 2_000));
    expect(first.loadLocalState()?.coins).toBe(500);
  });

  it("lets the player move the game to the new tab", async () => {
    const first = await openTab();
    first.claimSave(1_000);
    first.flushLocalState(stateWith(500, 1_000));

    const second = await openTab();
    second.claimSave(2_000);
    second.takeOverSave(2_000);
    second.flushLocalState(stateWith(900, 2_000));
    expect(second.loadLocalState()?.coins).toBe(900);

    // The tab that lost the lease must stop writing.
    expect(first.renewSaveLease(2_500)).toBe(false);
    first.flushLocalState(stateWith(500, 2_600));
    expect(second.loadLocalState()?.coins).toBe(900);
  });

  it("frees the save when the owning tab goes away", async () => {
    const first = await openTab();
    first.claimSave(1_000);
    first.releaseSaveLease();
    expect(storage.getItem(LEASE)).toBeNull();

    const second = await openTab();
    expect(second.claimSave(1_100)).toBe(true);
  });

  it("takes over a lease left behind by a crashed tab", async () => {
    const first = await openTab();
    first.claimSave(1_000);

    const second = await openTab();
    // Long enough after the last heartbeat that the tab is presumed gone.
    expect(second.claimSave(1_000 + 60_000)).toBe(true);
  });

  it("keeps a lone tab writing across heartbeats", async () => {
    const tab = await openTab();
    tab.claimSave(1_000);
    expect(tab.renewSaveLease(5_000)).toBe(true);
    expect(tab.renewSaveLease(9_000)).toBe(true);
    tab.flushLocalState(stateWith(42, 9_000));
    expect(tab.loadLocalState()?.coins).toBe(42);
  });
});
