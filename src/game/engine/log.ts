import type { GameState, LogEntry } from "@/game/types";

/** Keeping the log short matters: it ships with every save on the free tier. */
export const LOG_LIMIT = 40;

export function addLog(
  state: GameState,
  kind: LogEntry["kind"],
  th: string,
  en: string,
  at = Date.now(),
): void {
  state.log.unshift({ at, kind, text: { th, en } });
  if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;
}
