"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ITEM_BY_ID, SPECIES_BY_ID } from "@/game/data";
import { fishValue } from "@/game/engine";
import type { Locale } from "@/game/types";
import {
  acceptFriendAction,
  acceptTradeAction,
  addFriendAction,
  cancelTradeAction,
  claimGiftAction,
  createClubAction,
  createTradeAction,
  getSocialAction,
  joinClubAction,
  leaveClubAction,
  sendGiftAction,
  visitPondAction,
} from "@/app/actions/social";
import type { SocialSnapshot } from "@/lib/game/types";
import { Button, EmptyState, Panel } from "@/components/ui/primitives";
import { formatNumber, pick, t } from "@/lib/i18n";
import { useGame } from "@/store/gameStore";

export function FriendsPanel({
  locale,
  signedIn,
  initial,
}: {
  locale: Locale;
  signedIn: boolean;
  initial: SocialSnapshot | null;
}) {
  const [social, setSocial] = useState<SocialSnapshot | null>(initial);
  const [code, setCode] = useState("");
  const [clubName, setClubName] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const state = useGame((s) => s.state);
  const pushToast = useGame((s) => s.pushToast);
  const applyRemote = useGame((s) => s.applyRemoteState);

  const refresh = () =>
    startTransition(async () => {
      const next = await getSocialAction();
      if (next) setSocial(next);
    });

  const notify = (ok: boolean, error?: string) => {
    if (ok) {
      pushToast({ emoji: "✅", tone: "good", text: locale === "th" ? "เรียบร้อย" : "Done" });
      return;
    }
    const messages: Record<string, { th: string; en: string }> = {
      not_found: { th: "ไม่พบรหัสนี้", en: "Code not found" },
      self: { th: "นี่คือรหัสของคุณเอง", en: "That's your own code" },
      already_sent: { th: "วันนี้ส่งไปแล้ว", en: "Already sent today" },
      already_visited: { th: "วันนี้เยี่ยมแล้ว", en: "Already visited today" },
      not_friends: { th: "ต้องเป็นเพื่อนกันก่อน", en: "You need to be friends first" },
      name_taken: { th: "ชื่อนี้มีคนใช้แล้ว", en: "That name is taken" },
      name_too_short: { th: "ชื่อสั้นเกินไป", en: "Name is too short" },
      already_member: { th: "คุณอยู่ชมรมอื่นแล้ว", en: "You're already in a club" },
      cannot_afford: { th: "เหรียญไม่พอ", en: "Not enough coins" },
      bag_full: { th: "กระเป๋าเต็ม", en: "Your creel is full" },
    };
    const message = error ? messages[error] : undefined;
    pushToast({
      emoji: "⚠️",
      tone: "bad",
      text: message ? message[locale] : t(locale, "common.error"),
    });
  };

  if (!signedIn || !social) {
    return (
      <Panel title={t(locale, "friends.title")}>
        <EmptyState emoji="🤝" text={t(locale, "friends.needAccount")} />
        <Link href="/login" className="block">
          <Button full>{t(locale, "more.signIn")}</Button>
        </Link>
      </Panel>
    );
  }

  const accepted = social.friends.filter((f) => f.status === "accepted");
  const incoming = social.friends.filter((f) => f.incoming);
  const boards: { key: "biggest" | "dex" | "coins"; label: string }[] = [
    { key: "biggest", label: t(locale, "friends.board.biggest") },
    { key: "dex", label: t(locale, "friends.board.dex") },
    { key: "coins", label: t(locale, "friends.board.coins") },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t(locale, "friends.yourCode")}>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-xl border border-card-edge bg-paper-2 px-3 py-2 text-center text-sm font-extrabold tracking-widest">
            {social.self.friendCode}
          </code>
          <Button
            size="sm"
            tone="ghost"
            onClick={async () => {
              await navigator.clipboard?.writeText(social.self.friendCode);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? t(locale, "friends.copied") : t(locale, "friends.copy")}
          </Button>
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = code;
            setCode("");
            startTransition(async () => {
              const result = await addFriendAction(value);
              notify(result.ok, result.error);
              if (result.ok) refresh();
            });
          }}
        >
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t(locale, "friends.codePlaceholder")}
            className="min-w-0 flex-1 rounded-xl border border-card-edge bg-card px-3 py-2 text-sm outline-none focus:border-water"
          />
          <Button size="sm" type="submit" disabled={pending || code.trim().length < 4}>
            {t(locale, "friends.add")}
          </Button>
        </form>
      </Panel>

      {incoming.length > 0 && (
        <Panel title={locale === "th" ? "คำขอเป็นเพื่อน" : "Friend requests"}>
          <div className="flex flex-col gap-1.5">
            {incoming.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-card-edge bg-card px-2.5 py-2"
              >
                <span className="text-[13px] font-bold">{friend.name}</span>
                <Button
                  size="sm"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await acceptFriendAction(friend.id);
                      notify(result.ok, result.error);
                      refresh();
                    })
                  }
                >
                  {locale === "th" ? "รับเป็นเพื่อน" : "Accept"}
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title={`${t(locale, "friends.title")} · ${accepted.length}`}>
        {accepted.length === 0 ? (
          <EmptyState emoji="🎏" text={t(locale, "friends.none")} />
        ) : (
          <div className="flex flex-col gap-1.5">
            {accepted.map((friend) => {
              const biggest = friend.biggestSpecies
                ? SPECIES_BY_ID[friend.biggestSpecies]
                : null;
              return (
                <div
                  key={friend.id}
                  className="rounded-xl border border-card-edge bg-card px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold">{friend.name}</p>
                      <p className="text-[11px] text-ink-soft">
                        {t(locale, "hud.level")} {friend.level} · 📖 {friend.dexCount}
                        {biggest && ` · ${biggest.emoji} ${friend.biggestSize}${t(locale, "common.cm")}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        tone="ghost"
                        disabled={friend.visitedToday || pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await visitPondAction(friend.id);
                            notify(result.ok, result.error);
                            refresh();
                          })
                        }
                      >
                        {friend.visitedToday ? t(locale, "friends.visited") : t(locale, "friends.visit")}
                      </Button>
                      <Button
                        size="sm"
                        tone="sun"
                        disabled={friend.giftedToday || pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await sendGiftAction(friend.id);
                            notify(result.ok, result.error);
                            refresh();
                          })
                        }
                      >
                        🎁
                      </Button>
                    </div>
                  </div>
                  {friend.pondPreview.length > 0 && (
                    <p className="mt-1 text-sm" aria-hidden>
                      {friend.pondPreview
                        .map((entry) => SPECIES_BY_ID[entry.speciesId]?.emoji ?? "🐟")
                        .join(" ")}
                    </p>
                  )}
                  {state.bag.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-ink-soft">
                        {t(locale, "friends.tradeCreate")}:
                      </span>
                      {state.bag.slice(0, 3).map((fish) => {
                        const species = SPECIES_BY_ID[fish.speciesId];
                        const price = Math.round(fishValue(state, fish) * 1.1);
                        return (
                          <Button
                            key={fish.id}
                            size="sm"
                            tone="quiet"
                            onClick={() =>
                              startTransition(async () => {
                                const result = await createTradeAction(friend.id, fish.id, price);
                                if (result) {
                                  applyRemote(result.state);
                                  notify(result.effects.ok, result.effects.error);
                                }
                                refresh();
                              })
                            }
                          >
                            {species?.emoji} {formatNumber(price, locale)}🪙
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {social.gifts.length > 0 && (
        <Panel title={t(locale, "friends.gifts")}>
          <div className="flex flex-col gap-1.5">
            {social.gifts.map((gift) => {
              const item = ITEM_BY_ID[gift.itemId];
              return (
                <div
                  key={gift.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-card-edge bg-card px-2.5 py-2"
                >
                  <span className="text-[12px] font-bold">
                    {item?.emoji} {item ? pick(locale, item.name) : gift.itemId} ×{gift.qty}
                    <span className="ml-1 font-normal text-ink-soft">— {gift.fromName}</span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await claimGiftAction(gift.id);
                        notify(result.ok, result.error);
                        refresh();
                      })
                    }
                  >
                    {t(locale, "friends.claimGift")}
                  </Button>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {social.trades.length > 0 && (
        <Panel title={t(locale, "friends.trades")}>
          <div className="flex flex-col gap-1.5">
            {social.trades.map((trade) => {
              const species = SPECIES_BY_ID[trade.speciesId];
              return (
                <div
                  key={trade.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-card-edge bg-card px-2.5 py-2"
                >
                  <span className="min-w-0 text-[12px]">
                    <b>
                      {species?.emoji} {species ? pick(locale, species.name) : trade.speciesId}
                    </b>{" "}
                    {trade.sizeCm}
                    {t(locale, "common.cm")} · {"★".repeat(trade.stars)}
                    <span className="block text-ink-soft">
                      {trade.outgoing ? `→ ${trade.toName}` : `← ${trade.fromName}`} ·{" "}
                      {t(locale, "friends.tradeAsk")} {formatNumber(trade.askCoins, locale)}🪙
                    </span>
                  </span>
                  <Button
                    size="sm"
                    tone={trade.outgoing ? "ghost" : "primary"}
                    onClick={() =>
                      startTransition(async () => {
                        const result = trade.outgoing
                          ? await cancelTradeAction(trade.id)
                          : await acceptTradeAction(trade.id);
                        if (result) {
                          applyRemote(result.state);
                          notify(result.effects.ok, result.effects.error);
                        } else {
                          notify(false);
                        }
                        refresh();
                      })
                    }
                  >
                    {trade.outgoing ? t(locale, "friends.tradeCancel") : t(locale, "friends.tradeAccept")}
                  </Button>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel title={t(locale, "friends.leaderboard")}>
        <div className="flex flex-col gap-3">
          {boards.map((board) => (
            <div key={board.key}>
              <p className="mb-1 text-[12px] font-bold">{board.label}</p>
              <ol className="flex flex-col gap-1">
                {social.boards[board.key].map((row, index) => (
                  <li
                    key={`${board.key}-${row.userId}`}
                    className={`flex items-center justify-between rounded-lg px-2 py-1 text-[12px] ${
                      row.isSelf ? "bg-foam font-bold" : ""
                    }`}
                  >
                    <span className="truncate">
                      {index + 1}. {row.isSelf ? t(locale, "common.you") : row.name}
                    </span>
                    <span className="tabular-nums">
                      {board.key === "biggest"
                        ? `${row.score}${t(locale, "common.cm")}`
                        : formatNumber(row.score, locale)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={t(locale, "friends.club")}>
        {social.club ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-bold">🎏 {social.club.name}</p>
            {social.club.goals.map((goal) => (
              <div key={goal.goalId}>
                <p className="text-[11px] text-ink-soft">
                  {t(locale, "friends.clubGoal")}: {formatNumber(goal.progress, locale)}/
                  {formatNumber(goal.target, locale)}
                </p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-2">
                  <div
                    className="h-full rounded-full bg-moss"
                    style={{ width: `${Math.min(100, (goal.progress / goal.target) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-ink-soft">
              {t(locale, "friends.clubMembers")}:{" "}
              {social.club.members.map((member) => member.name).join(", ")}
            </p>
            <Button
              size="sm"
              tone="quiet"
              onClick={() =>
                startTransition(async () => {
                  const result = await leaveClubAction();
                  notify(result.ok, result.error);
                  refresh();
                })
              }
            >
              {locale === "th" ? "ออกจากชมรม" : "Leave club"}
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => event.preventDefault()}
          >
            <input
              value={clubName}
              onChange={(event) => setClubName(event.target.value)}
              placeholder={locale === "th" ? "ชื่อชมรม" : "Club name"}
              className="rounded-xl border border-card-edge bg-card px-3 py-2 text-sm outline-none focus:border-water"
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                disabled={clubName.trim().length < 3 || pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await createClubAction(clubName);
                    notify(result.ok, result.error);
                    refresh();
                  })
                }
              >
                {t(locale, "friends.clubCreate")}
              </Button>
              <Button
                size="sm"
                tone="ghost"
                disabled={clubName.trim().length < 3 || pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await joinClubAction(clubName);
                    notify(result.ok, result.error);
                    refresh();
                  })
                }
              >
                {t(locale, "friends.clubJoin")}
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
