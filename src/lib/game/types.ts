import type { CommandEffects } from "@/game/engine";
import type { GameState } from "@/game/types";

export interface GameSnapshot {
  state: GameState;
  effects: CommandEffects;
}

export interface AccountInfo {
  signedIn: boolean;
  label: string | null;
  isAnonymous: boolean;
  cloudAvailable: boolean;
}

export interface FriendSummary {
  id: string;
  name: string;
  friendCode: string;
  level: number;
  dexCount: number;
  biggestSpecies: string | null;
  biggestSize: number;
  pondPreview: { speciesId: string; stars: number }[];
  status: "pending" | "accepted";
  incoming: boolean;
  visitedToday: boolean;
  giftedToday: boolean;
}

export interface GiftSummary {
  id: string;
  fromName: string;
  itemId: string;
  qty: number;
  createdAt: string;
}

export interface BoardRow {
  userId: string;
  name: string;
  score: number;
  detail?: string | null;
  isSelf: boolean;
}

export interface TradeSummary {
  id: string;
  fromName: string;
  toName: string;
  outgoing: boolean;
  speciesId: string;
  sizeCm: number;
  stars: number;
  mutation: string | null;
  askCoins: number;
  status: "open" | "accepted" | "cancelled";
}

export interface ClubGoal {
  goalId: string;
  progress: number;
  target: number;
}

export interface ClubSummary {
  id: string;
  name: string;
  motto: string | null;
  isOwner: boolean;
  members: { id: string; name: string; level: number; isSelf: boolean }[];
  goals: ClubGoal[];
}

export interface SocialSnapshot {
  self: { id: string; name: string; friendCode: string };
  friends: FriendSummary[];
  gifts: GiftSummary[];
  boards: { biggest: BoardRow[]; dex: BoardRow[]; coins: BoardRow[] };
  trades: TradeSummary[];
  club: ClubSummary | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}
