import { migrateState } from "@/game/engine";
import type { GameState } from "@/game/types";

export const SAVE_KEY = "cozy-fishing-idle:save";
const PENDING_MIGRATION_KEY = "cozy-fishing-idle:pending-cloud-migration";

export function loadLocalState(now = Date.now()): GameState | null {
  return parseSave(read(), now);
}

/** Parses a raw save string, migrating it forward. */
export function parseSave(raw: string | null, now = Date.now()): GameState | null {
  if (!raw) return null;
  try {
    return migrateState(JSON.parse(raw), now);
  } catch {
    return null;
  }
}

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

function write(state: GameState): void {
  if (!ownsSave) return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private mode): the game still runs in memory.
  }
}

/**
 * One save, possibly several tabs. A tab left open in the background would
 * otherwise write its stale state over a session played elsewhere and roll the
 * player back, so exactly one tab holds the save at a time and the others play
 * read-only until the player moves the game over.
 */
const LEASE_KEY = "cozy-fishing-idle:writer";
const LEASE_STALE_MS = 12_000;
export const LEASE_HEARTBEAT_MS = 4_000;

const tabId = Math.random().toString(36).slice(2);
let ownsSave = false;

function currentLease(): { tabId: string; at: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEASE_KEY);
    if (!raw) return null;
    const lease = JSON.parse(raw) as { tabId?: unknown; at?: unknown };
    if (typeof lease.tabId !== "string" || typeof lease.at !== "number") return null;
    return { tabId: lease.tabId, at: lease.at };
  } catch {
    return null;
  }
}

function stamp(now: number): void {
  try {
    window.localStorage.setItem(LEASE_KEY, JSON.stringify({ tabId, at: now }));
  } catch {
    /* ignore */
  }
}

/** Claims the save unless a live tab already holds it. Returns true if we own it. */
export function claimSave(now = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  const lease = currentLease();
  const heldElsewhere = !!lease && lease.tabId !== tabId && now - lease.at < LEASE_STALE_MS;
  ownsSave = !heldElsewhere;
  if (ownsSave) stamp(now);
  return ownsSave;
}

/** Moves the save to this tab even though another tab still has it open. */
export function takeOverSave(now = Date.now()): void {
  ownsSave = true;
  stamp(now);
}

/** Keeps the lease alive; a tab that closes stops renewing and the lease goes stale. */
export function renewSaveLease(now = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  const lease = currentLease();
  if (lease && lease.tabId !== tabId && now - lease.at < LEASE_STALE_MS) {
    ownsSave = false;
    return false;
  }
  ownsSave = true;
  stamp(now);
  return true;
}

/**
 * Hands the save back when this tab closes or reloads, so the next page load
 * does not mistake our own last heartbeat for a rival tab.
 */
export function releaseSaveLease(): void {
  if (typeof window === "undefined") return;
  const lease = currentLease();
  if (lease && lease.tabId !== tabId) return;
  ownsSave = false;
  try {
    window.localStorage.removeItem(LEASE_KEY);
  } catch {
    /* ignore */
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveLocalState(state: GameState): void {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  // Debounced: casting can fire several times a second.
  saveTimer = setTimeout(() => write(state), 400);
}

export function flushLocalState(state: GameState): void {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  write(state);
}

export function clearLocalState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SAVE_KEY);
}

/**
 * A guest who signs in should keep their progress. The save is stashed here and
 * uploaded once, right after the first authenticated load.
 */
export function markSaveForUpload(state: GameState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_MIGRATION_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function takeSaveForUpload(): GameState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PENDING_MIGRATION_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(PENDING_MIGRATION_KEY);
  try {
    return migrateState(JSON.parse(raw));
  } catch {
    return null;
  }
}
