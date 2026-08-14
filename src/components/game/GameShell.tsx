"use client";

import { useEffect, useRef } from "react";
import { applyCommand, createInitialState } from "@/game/engine";
import type { GameState, IdleReport } from "@/game/types";
import { runCommandAction, uploadGuestSaveAction } from "@/app/actions/game";
import type { AccountInfo, SocialSnapshot } from "@/lib/game/types";
import {
  claimSave,
  flushLocalState,
  LEASE_HEARTBEAT_MS,
  loadLocalState,
  releaseSaveLease,
  renewSaveLease,
  saveLocalState,
  takeOverSave,
  takeSaveForUpload,
} from "@/lib/save/local";
import { resumeAudio, startMusic, stopMusic } from "@/lib/sound";
import { useGame } from "@/store/gameStore";
import { Button } from "@/components/ui/primitives";
import { BagPanel } from "./BagPanel";
import { DexPanel } from "./DexPanel";
import { FishingScene, ZoneStrip } from "./FishingScene";
import { FriendsPanel } from "./FriendsPanel";
import { BottomTabs, NavRail, TopBar, Toasts } from "./Hud";
import { MorePanel } from "./MorePanel";
import { PondPanel } from "./PondPanel";
import { ShopPanel } from "./ShopPanel";
import { WelcomeBack } from "./WelcomeBack";

export function GameShell({
  mode,
  initialState,
  initialIdle,
  account,
  social,
}: {
  mode: "guest" | "cloud";
  initialState: GameState | null;
  initialIdle: IdleReport | null;
  account: AccountInfo;
  social: SocialSnapshot | null;
}) {
  const ready = useGame((s) => s.ready);
  const init = useGame((s) => s.init);
  const run = useGame((s) => s.run);
  const applyRemoteState = useGame((s) => s.applyRemoteState);
  const state = useGame((s) => s.state);
  const tab = useGame((s) => s.tab);
  const migrating = useGame((s) => s.migrating);
  const setMigrating = useGame((s) => s.setMigrating);
  const saveLocked = useGame((s) => s.saveLocked);
  const setSaveLocked = useGame((s) => s.setSaveLocked);
  const bootstrapped = useRef(false);
  const fishColumnRef = useRef<HTMLDivElement>(null);

  // Boot: cloud state comes from the server, guest state from localStorage.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    if (mode === "cloud" && initialState) {
      init({
        mode,
        state: initialState,
        transport: { run: runCommandAction },
        idle: initialIdle,
      });

      const pending = takeSaveForUpload();
      if (pending) {
        setMigrating(true);
        void uploadGuestSaveAction(pending)
          .then((snapshot) => {
            if (snapshot) applyRemoteState(snapshot.state);
          })
          .finally(() => setMigrating(false));
      }
      return;
    }

    const owned = claimSave();
    setSaveLocked(!owned);
    const local = loadLocalState() ?? createInitialState();
    const settled = applyCommand(local, { type: "tick" });
    saveLocalState(settled.state);
    init({ mode: "guest", state: settled.state, idle: settled.effects.idle ?? null });
  }, [mode, initialState, initialIdle, init, applyRemoteState, setMigrating, setSaveLocked]);

  const locale = state.settings.locale;
  const theme = state.settings.theme;
  const reducedMotion = state.settings.reducedMotion;

  // Theme follows the save, and keeps following the OS while set to "system".
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
  }, [locale, reducedMotion]);

  useEffect(() => {
    if (state.settings.music) startMusic();
    else stopMusic();
  }, [state.settings.music]);

  // Keep offline progress honest: settle time when coming back to the tab.
  useEffect(() => {
    if (!ready) return;
    const settle = () => void run({ type: "tick" });
    const onVisible = () => {
      if (document.visibilityState === "visible") settle();
    };
    const interval = window.setInterval(settle, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [ready, run]);

  // Only the tab holding the save may write it, and it has to keep saying so.
  useEffect(() => {
    if (mode !== "guest") return;
    const id = window.setInterval(() => {
      setSaveLocked(!renewSaveLease());
    }, LEASE_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [mode, setSaveLocked]);

  useEffect(() => {
    const flush = () => {
      if (useGame.getState().mode !== "guest") return;
      flushLocalState(useGame.getState().state);
      releaseSaveLease();
    };
    const unlock = () => resumeAudio();
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  // Below `lg` the fishing column is hidden with display:none instead of being
  // unmounted, and that on its own does not replay a CSS animation. Restart it
  // by hand so coming back to the fish tab enters like every other tab does.
  useEffect(() => {
    if (tab !== "fish") return;
    if (window.matchMedia("(min-width: 64rem)").matches) return;
    for (const animation of fishColumnRef.current?.getAnimations() ?? []) {
      animation.cancel();
      animation.play();
    }
  }, [tab]);

  const panel = (() => {
    switch (tab) {
      case "pond":
        return <PondPanel locale={locale} />;
      case "shop":
        return <ShopPanel locale={locale} />;
      case "dex":
        return <DexPanel locale={locale} />;
      case "friends":
        return <FriendsPanel locale={locale} signedIn={account.signedIn} initial={social} />;
      case "more":
        return <MorePanel locale={locale} account={account} />;
      default:
        return <BagPanel locale={locale} />;
    }
  })();

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar locale={locale} />
      <Toasts />

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-24 pt-3 lg:pb-6">
        <div className="lg:grid lg:grid-cols-[9.5rem_minmax(0,1fr)_minmax(0,25rem)] lg:gap-4">
          <NavRail locale={locale} />

          {/*
            Animates once on load only. It must not be keyed on the tab: the
            scene stays mounted while you browse other tabs so the deck cat
            keeps fishing, and remounting would restart that timer every switch.
          */}
          <div
            ref={fishColumnRef}
            className={`animate-panel-in flex-col gap-3 ${tab === "fish" ? "flex" : "hidden lg:flex"}`}
          >
            <FishingScene locale={locale} />
            <ZoneStrip locale={locale} />
          </div>

          {/* Keyed on the tab so every switch remounts and replays the entrance. */}
          <div
            key={tab}
            className={`animate-panel-in flex flex-col gap-3 ${tab === "fish" ? "mt-3 lg:mt-0" : ""}`}
          >
            {panel}
          </div>
        </div>
      </main>

      <BottomTabs locale={locale} />
      <WelcomeBack locale={locale} />

      {migrating && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center lg:bottom-4">
          <span className="cozy-card px-3 py-1.5 text-[12px] font-bold">
            {locale === "th" ? "กำลังย้ายเซฟขึ้นคลาวด์..." : "Moving your save to the cloud..."}
          </span>
        </div>
      )}

      {saveLocked && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-3 lg:bottom-4">
          <div className="cozy-card flex items-center gap-2 px-3 py-2 text-[12px] font-semibold">
            <span aria-hidden>🗂️</span>
            <span>
              {locale === "th"
                ? "เกมเปิดอยู่ในแท็บอื่น ตาที่นี่จะไม่ถูกบันทึก"
                : "The game is open in another tab, so this one won't save."}
            </span>
            <Button
              size="sm"
              onClick={() => {
                takeOverSave();
                const local = loadLocalState();
                if (local) applyRemoteState(applyCommand(local, { type: "tick" }).state);
                setSaveLocked(false);
              }}
            >
              {locale === "th" ? "เล่นที่นี่" : "Play here"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
