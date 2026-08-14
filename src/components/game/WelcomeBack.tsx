"use client";

import { SPECIES_BY_ID } from "@/game/data";
import { formatDuration } from "@/game/engine";
import type { Locale } from "@/game/types";
import { Button, Modal } from "@/components/ui/primitives";
import { formatNumber, t } from "@/lib/i18n";
import { useGame } from "@/store/gameStore";

export function WelcomeBack({ locale }: { locale: Locale }) {
  const report = useGame((s) => s.welcomeBack);
  const dismiss = useGame((s) => s.dismissWelcome);
  if (!report) return null;

  const bySpecies = new Map<string, number>();
  for (const fish of report.caught) {
    bySpecies.set(fish.speciesId, (bySpecies.get(fish.speciesId) ?? 0) + 1);
  }

  return (
    <Modal
      open
      onClose={dismiss}
      title={`🐈 ${t(locale, "welcome.title")}`}
      footer={
        <Button onClick={dismiss} size="sm">
          {t(locale, "welcome.ok")}
        </Button>
      }
    >
      <p className="text-[13px] text-ink-soft">
        {t(locale, "welcome.away")} {formatDuration(report.elapsedMs, locale)}
        {report.cappedMs < report.elapsedMs &&
          ` (${locale === "th" ? "เก็บได้ถึงเพดาน" : "capped at"} ${formatDuration(report.cappedMs, locale)})`}
      </p>

      {report.caught.length > 0 && (
        <div className="mt-2">
          <p className="text-[12px] font-bold">
            {t(locale, "welcome.catCaught")} {report.caught.length}
          </p>
          <p className="text-lg" aria-hidden>
            {[...bySpecies.entries()]
              .map(([speciesId, count]) => `${SPECIES_BY_ID[speciesId]?.emoji ?? "🐟"}×${count}`)
              .join("  ")}
          </p>
        </div>
      )}

      {report.autoSoldCount > 0 && (
        <p className="mt-1.5 text-[12px]">
          {t(locale, "welcome.autoSold")} {report.autoSoldCount} ·{" "}
          <b className="text-moss">+{formatNumber(report.autoSoldCoins, locale)}🪙</b>
        </p>
      )}

      {report.pondCoins > 0 && (
        <p className="mt-1.5 text-[12px]">
          {t(locale, "welcome.pondWaiting")}:{" "}
          <b className="text-moss">{formatNumber(report.pondCoins, locale)}🪙</b>
          {report.pondPearls > 0 && ` · ${report.pondPearls}🫧`}
        </p>
      )}
    </Modal>
  );
}
