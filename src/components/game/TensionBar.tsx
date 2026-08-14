"use client";

import { useEffect, useRef } from "react";
import { barPosition } from "@/game/engine";
import type { Locale, PendingCast } from "@/game/types";
import { t } from "@/lib/i18n";

/**
 * The timing minigame. The marker is moved by mutating a transform inside a
 * requestAnimationFrame loop — no React state per frame, so it stays at 60fps
 * on a phone while the rest of the UI keeps its own pace.
 */
export function TensionBar({
  cast,
  barStartedAt,
  locale,
  onTap,
}: {
  cast: PendingCast;
  barStartedAt: number;
  locale: Locale;
  onTap: () => void;
}) {
  const markerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - barStartedAt;
      const pos = barPosition(cast.barSeed, elapsed, cast.sweepMs);
      if (markerRef.current) {
        markerRef.current.style.left = `${pos * 100}%`;
      }
      if (timerRef.current) {
        const left = Math.max(0, 1 - elapsed / cast.timeoutMs);
        timerRef.current.style.transform = `scaleX(${left})`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cast.barSeed, cast.sweepMs, cast.timeoutMs, barStartedAt]);

  const zoneLeft = Math.max(0, (cast.zoneCenter - cast.zoneWidth / 2) * 100);
  const zoneWidth = Math.min(100 - zoneLeft, cast.zoneWidth * 100);

  return (
    <div className="animate-pop-in w-full select-none">
      <p className="mb-1.5 text-center text-xs font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
        {t(locale, "fish.hooked")}
      </p>
      <button
        type="button"
        onClick={onTap}
        aria-label={t(locale, "fish.tap")}
        className="relative block h-14 w-full overflow-hidden rounded-2xl border-2 border-white/70 bg-water-deep/85 shadow-[var(--shadow-soft)] backdrop-blur-sm active:scale-[0.99]"
      >
        <div
          className="absolute inset-y-1 rounded-xl border border-white/50"
          style={{
            left: `${zoneLeft}%`,
            width: `${zoneWidth}%`,
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--moss), white 35%), var(--moss))",
          }}
        />
        <div
          ref={markerRef}
          className="absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_2px_rgba(255,255,255,0.8)]"
          style={{ left: "0%" }}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-extrabold tracking-widest text-white/90 drop-shadow">
          {t(locale, "fish.tap")}
        </span>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
          <div
            ref={timerRef}
            className="h-full origin-left bg-coral"
            style={{ transform: "scaleX(1)" }}
          />
        </div>
      </button>
    </div>
  );
}
