"use client";

import { useState } from "react";
import Link from "next/link";
import { SPECIES_BY_ID } from "@/game/data";
import { formatDuration, prestigeInfo } from "@/game/engine";
import type { GameSettings, Locale } from "@/game/types";
import { SpeciesIcon } from "@/components/game/FishCard";
import { Button, Modal, Panel } from "@/components/ui/primitives";
import { useNow } from "@/lib/hooks";
import { formatNumber, pick, t } from "@/lib/i18n";
import { startMusic, stopMusic } from "@/lib/sound";
import { useGame } from "@/store/gameStore";

export function MorePanel({
  locale,
  account,
}: {
  locale: Locale;
  account: { signedIn: boolean; label: string | null };
}) {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  const now = useNow(30_000);
  const [confirmPrestige, setConfirmPrestige] = useState(false);

  const info = prestigeInfo(state);
  const biggest = state.stats.biggest;
  const biggestSpecies = biggest ? SPECIES_BY_ID[biggest.speciesId] : null;

  const setSetting = (patch: Partial<GameSettings>) => {
    void run({ type: "updateSettings", patch });
    if (patch.music === true) startMusic();
    if (patch.music === false) stopMusic();
  };

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t(locale, "more.account")}>
        {account.signedIn ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-bold">
              ☁️ {account.label ?? (locale === "th" ? "บัญชีคลาวด์" : "Cloud account")}
            </p>
            <form action="/auth/signout" method="post">
              <Button size="sm" tone="ghost" type="submit">
                {t(locale, "more.signOut")}
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-ink-soft">{t(locale, "more.guest")}</p>
            <Link href="/login">
              <Button size="sm">{t(locale, "more.signIn")}</Button>
            </Link>
          </div>
        )}
      </Panel>

      <Panel title={t(locale, "more.title")}>
        <div className="flex flex-col gap-3">
          <Row label={t(locale, "more.language")}>
            <Segmented
              options={[
                { id: "th", label: "ไทย" },
                { id: "en", label: "English" },
              ]}
              value={state.settings.locale}
              onChange={(value) => setSetting({ locale: value as Locale })}
            />
          </Row>

          <Row label={t(locale, "more.theme")}>
            <Segmented
              options={[
                { id: "light", label: t(locale, "more.themeLight") },
                { id: "dark", label: t(locale, "more.themeDark") },
                { id: "system", label: t(locale, "more.themeSystem") },
              ]}
              value={state.settings.theme}
              onChange={(value) => setSetting({ theme: value as GameSettings["theme"] })}
            />
          </Row>

          <Toggle
            label={t(locale, "more.sound")}
            checked={state.settings.sound}
            onChange={(checked) => setSetting({ sound: checked })}
          />
          <Toggle
            label={t(locale, "more.music")}
            checked={state.settings.music}
            onChange={(checked) => setSetting({ music: checked })}
          />
          <Toggle
            label={t(locale, "more.motion")}
            checked={state.settings.reducedMotion}
            onChange={(checked) => setSetting({ reducedMotion: checked })}
          />
        </div>
      </Panel>

      <Panel title={t(locale, "more.stats")}>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
          <Stat label={locale === "th" ? "ตกได้ทั้งหมด" : "Total catches"} value={formatNumber(state.stats.totalCaught, locale)} />
          <Stat label={locale === "th" ? "ขายไปแล้ว" : "Fish sold"} value={formatNumber(state.stats.totalSold, locale)} />
          <Stat label={locale === "th" ? "เหรียญที่หาได้" : "Coins earned"} value={formatNumber(state.stats.coinsEarned, locale)} />
          <Stat label={locale === "th" ? "เหวี่ยงเบ็ด" : "Casts"} value={formatNumber(state.stats.casts, locale)} />
          <Stat label={locale === "th" ? "จังหวะเป๊ะ" : "Perfect casts"} value={formatNumber(state.stats.perfectCasts, locale)} />
          <Stat label={locale === "th" ? "ผสมพันธุ์" : "Bred"} value={formatNumber(state.stats.bred, locale)} />
          <Stat label={locale === "th" ? "กลายพันธุ์" : "Mutations"} value={formatNumber(state.stats.mutations, locale)} />
          <Stat
            label={locale === "th" ? "เล่นมาแล้ว" : "Played for"}
            value={formatDuration(now - state.createdAt, locale)}
          />
          {biggestSpecies && biggest && (
            <Stat
              label={locale === "th" ? "ปลาตัวใหญ่สุด" : "Biggest catch"}
              value={
                <span className="flex items-center justify-end gap-1.5">
                  <SpeciesIcon speciesId={biggest.speciesId} size={16} />
                  <span className="truncate">
                    {pick(locale, biggestSpecies.name)} {biggest.sizeCm}
                    {t(locale, "common.cm")}
                  </span>
                </span>
              }
            />
          )}
        </dl>
      </Panel>

      <Panel title={`🕊️ ${t(locale, "more.prestige")}`}>
        <p className="text-[12px] text-ink-soft">{t(locale, "more.prestigeBlurb")}</p>
        <p className="mt-1.5 text-[12px]">
          {t(locale, "more.blessing")}: <b>+{Math.round(info.currentBlessing * 100)}%</b>
          {" → "}
          <b className="text-moss">+{Math.round(info.nextBlessing * 100)}%</b>
        </p>
        <Button
          size="sm"
          tone="coral"
          className="mt-2"
          disabled={!info.eligible}
          onClick={() => setConfirmPrestige(true)}
        >
          {info.eligible
            ? t(locale, "more.prestige")
            : `${t(locale, "fish.needLevel")} ${info.minLevel}`}
        </Button>
      </Panel>

      <Panel title={t(locale, "more.log")}>
        <ul className="flex flex-col gap-1 text-[11px] text-ink-soft">
          {state.log.slice(0, 14).map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="flex gap-1.5">
              <span className="shrink-0 tabular-nums opacity-70">
                {new Date(entry.at).toLocaleTimeString(locale === "th" ? "th-TH" : "en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span>{pick(locale, entry.text)}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Modal
        open={confirmPrestige}
        onClose={() => setConfirmPrestige(false)}
        title={t(locale, "more.prestigeConfirm")}
        footer={
          <>
            <Button tone="ghost" size="sm" onClick={() => setConfirmPrestige(false)}>
              {t(locale, "common.cancel")}
            </Button>
            <Button
              tone="coral"
              size="sm"
              onClick={() => {
                void run({ type: "prestige" });
                setConfirmPrestige(false);
              }}
            >
              {t(locale, "common.confirm")}
            </Button>
          </>
        }
      >
        {t(locale, "more.prestigeBlurb")}
      </Modal>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[12px] font-semibold">{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-full border border-card-edge">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`px-2.5 py-1 text-[11px] font-bold transition ${
            value === option.id ? "bg-water text-white" : "bg-card hover:bg-paper-2"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2">
      <span className="text-[12px] font-semibold">{label}</span>
      <span className="relative inline-block h-6 w-11">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-card-edge transition peer-checked:bg-water" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </>
  );
}
