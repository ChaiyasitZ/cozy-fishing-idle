"use client";

import { useState } from "react";
import {
  ACHIEVEMENTS,
  QUEST_BY_ID,
  RARITY_COLOR,
  RARITY_LABEL,
  SPECIES,
  ZONE_BY_ID,
} from "@/game/data";
import { isQuestComplete } from "@/game/engine";
import type { Locale, QuestState, ZoneId } from "@/game/types";
import { Bar, Button, Panel } from "@/components/ui/primitives";
import { SpeciesCardPortrait } from "./FishCard";
import { formatNumber, pick, t } from "@/lib/i18n";
import { useGame } from "@/store/gameStore";

type DexTab = "dex" | "quests" | "achievements";

export function DexPanel({ locale }: { locale: Locale }) {
  const state = useGame((s) => s.state);
  const [tab, setTab] = useState<DexTab>("dex");

  const found = Object.keys(state.fishdex).length;
  const tabs: { id: DexTab; label: string; emoji: string }[] = [
    { id: "dex", label: t(locale, "dex.title"), emoji: "📖" },
    { id: "quests", label: t(locale, "dex.quests"), emoji: "📜" },
    { id: "achievements", label: t(locale, "dex.achievements"), emoji: "🏅" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${
              tab === entry.id
                ? "border-water bg-water text-white"
                : "border-card-edge bg-card hover:bg-paper-2"
            }`}
          >
            <span aria-hidden>{entry.emoji}</span> {entry.label}
          </button>
        ))}
      </div>

      {tab === "dex" && (
        <Panel
          title={`${t(locale, "dex.progress")} ${found}/${SPECIES.length}`}
          action={
            <span className="w-24">
              <Bar value={found} max={SPECIES.length} height={6} />
            </span>
          }
        >
          <div className="flex flex-col gap-3">
            {(Object.keys(ZONE_BY_ID) as ZoneId[]).map((zoneId) => {
              const zone = ZONE_BY_ID[zoneId];
              const list = SPECIES.filter((s) => s.zone === zoneId);
              return (
                <div key={zoneId}>
                  <p className="mb-1.5 text-[12px] font-bold">
                    {zone.emoji} {pick(locale, zone.name)}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {list.map((species) => {
                      const entry = state.fishdex[species.id];
                      return (
                        <div
                          key={species.id}
                          className={`overflow-hidden rounded-2xl border ${
                            entry
                              ? "border-card-edge bg-card"
                              : "border-dashed border-card-edge bg-paper-2/40"
                          }`}
                        >
                          <SpeciesCardPortrait
                            speciesId={species.id}
                            locked={!entry}
                          />
                          <div className="space-y-0.5 px-2.5 py-2">
                            <p className="truncate text-[12px] font-bold">
                              {entry ? pick(locale, species.name) : "???"}
                            </p>
                            {entry && (
                              <p className="text-[10px] text-ink-soft">
                                {t(locale, "dex.caught")} {entry.count} ·{" "}
                                {t(locale, "dex.biggest")} {entry.maxSize}
                                {t(locale, "common.cm")}
                              </p>
                            )}
                            <p
                              className="text-[10px] font-semibold"
                              style={{ color: RARITY_COLOR[species.rarity] }}
                            >
                              {pick(locale, RARITY_LABEL[species.rarity])}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {tab === "quests" && (
        <>
          <QuestList locale={locale} title={t(locale, "dex.daily")} quests={state.quests.daily} />
          <QuestList locale={locale} title={t(locale, "dex.weekly")} quests={state.quests.weekly} />
        </>
      )}

      {tab === "achievements" && (
        <Panel title={t(locale, "dex.achievements")}>
          <div className="flex flex-col gap-1.5">
            {ACHIEVEMENTS.map((achievement) => {
              const unlocked = state.achievements.includes(achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${
                    unlocked ? "border-sun bg-card" : "border-card-edge bg-paper-2/40 opacity-70"
                  }`}
                >
                  <span className="text-xl" aria-hidden>
                    {unlocked ? achievement.emoji : "🔒"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">
                      {pick(locale, achievement.name)}
                    </p>
                    <p className="text-[11px] text-ink-soft">{pick(locale, achievement.blurb)}</p>
                  </div>
                  <span className="text-[11px] font-bold text-moss">
                    {achievement.reward.coins > 0 &&
                      `${formatNumber(achievement.reward.coins, locale)}🪙`}
                    {achievement.reward.pearls > 0 && ` ${achievement.reward.pearls}🫧`}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

function QuestList({
  locale,
  title,
  quests,
}: {
  locale: Locale;
  title: string;
  quests: QuestState[];
}) {
  const run = useGame((s) => s.run);

  return (
    <Panel title={title}>
      <div className="flex flex-col gap-1.5">
        {quests.map((entry) => {
          const quest = QUEST_BY_ID[entry.id];
          if (!quest) return null;
          const complete = isQuestComplete(entry);
          return (
            <div key={entry.id} className="rounded-xl border border-card-edge bg-card px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-bold">{pick(locale, quest.name)}</p>
                {entry.claimed ? (
                  <span className="text-[11px] font-bold text-ink-soft">
                    {t(locale, "dex.claimed")}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    tone={complete ? "sun" : "quiet"}
                    disabled={!complete}
                    onClick={() => void run({ type: "claimQuest", questId: entry.id })}
                  >
                    {t(locale, "dex.claim")}
                  </Button>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex-1">
                  <Bar
                    value={entry.progress}
                    max={quest.target}
                    height={5}
                    tone={complete ? "var(--moss)" : "var(--water)"}
                  />
                </span>
                <span className="text-[10px] text-ink-soft">
                  {formatNumber(entry.progress, locale)}/{formatNumber(quest.target, locale)}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-ink-soft">
                +{formatNumber(quest.reward.coins, locale)}🪙 · +{quest.reward.xp} XP
                {quest.reward.pearls ? ` · +${quest.reward.pearls}🫧` : ""}
              </p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
