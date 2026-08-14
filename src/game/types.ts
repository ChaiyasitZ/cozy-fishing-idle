export type Locale = "th" | "en";

export type Localized = Record<Locale, string>;

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export type ZoneId = "pond" | "river" | "lake" | "sea" | "deep" | "reef";

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export type WeatherId = "clear" | "cloudy" | "rain" | "storm" | "fog" | "moonlit";

export type MutationId = "shiny" | "albino" | "prismatic";

export interface Species {
  id: string;
  name: Localized;
  emoji: string;
  /** Optional PNG under /public, used instead of the emoji when present. */
  image?: string;
  zone: ZoneId;
  rarity: Rarity;
  /** Coin value of a median-size, 1-star specimen before any multipliers. */
  basePrice: number;
  /** [min, max] length in centimetres. */
  size: [number, number];
  /** Hours in the pond before the fish matures. */
  growHours: number;
  /** Coins produced per hour once mature. */
  yieldPerHour: number;
  boostTime?: TimeOfDay[];
  boostWeather?: WeatherId[];
  /** Only bites during these times of day. */
  requireTime?: TimeOfDay[];
  breedable: boolean;
}

export interface Zone {
  id: ZoneId;
  name: Localized;
  blurb: Localized;
  emoji: string;
  /** Sky/water gradient stops used by the fishing scene. */
  palette: { sky: [string, string]; water: [string, string] };
  unlock: { level: number; coins: number; boatLevel: number };
  /** Multiplier applied to the value of everything caught here. */
  valueMultiplier: number;
  /** Base seconds the tension bar takes for one full sweep. */
  sweepSeconds: number;
  junkChance: number;
}

export type ItemKind = "bait" | "food" | "material";

export interface Item {
  id: string;
  kind: ItemKind;
  name: Localized;
  emoji: string;
  /** Shop price. Materials are not sold in the shop (buy === null). */
  buy: number | null;
  sell: number;
  /** Bait only. */
  bait?: {
    luck: number;
    sizeBonus: number;
    boostZones?: ZoneId[];
    boostTime?: TimeOfDay[];
  };
  /** Food only: pond growth speed and cleanliness restored. */
  food?: { growthMultiplier: number; freshness: number };
}

export type UpgradeId =
  | "rod"
  | "line"
  | "reel"
  | "creel"
  | "cooler"
  | "lantern"
  | "boat"
  | "helper"
  | "rack"
  | "charm"
  | "pond";

export interface Upgrade {
  id: UpgradeId;
  name: Localized;
  blurb: Localized;
  emoji: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  /** Human-readable effect per level, for the UI. */
  effect: Localized;
}

export type SkillId =
  | "luck"
  | "patience"
  | "swift"
  | "keeper"
  | "merchant"
  | "breeder"
  | "dreamer";

export interface Skill {
  id: SkillId;
  name: Localized;
  blurb: Localized;
  emoji: string;
  maxLevel: number;
}

export type QuestPeriod = "daily" | "weekly";

export type QuestMetric =
  | "catch"
  | "sell"
  | "coins"
  | "feed"
  | "rare"
  | "epic"
  | "stock"
  | "breed"
  | "visit"
  | "gift"
  | "dailyDone";

export interface Quest {
  id: string;
  period: QuestPeriod;
  metric: QuestMetric;
  target: number;
  name: Localized;
  reward: { coins: number; xp: number; pearls?: number; item?: { id: string; qty: number } };
}

export interface Achievement {
  id: string;
  name: Localized;
  blurb: Localized;
  emoji: string;
  reward: { coins: number; pearls: number };
}

/* ---------------------------------------------------------------- save state */

export interface FishInstance {
  id: string;
  speciesId: string;
  sizeCm: number;
  stars: number;
  mutation: MutationId | null;
  caughtAt: number;
  zoneId: ZoneId;
}

export interface PondFish extends FishInstance {
  placedAt: number;
  /** Epoch ms when this fish becomes mature; derived at placement time. */
  maturesAt: number;
  lastHarvestAt: number;
  lastBredAt?: number;
}

export interface PendingCast {
  id: string;
  startedAt: number;
  /** Deterministic seed for the tension bar path. */
  barSeed: number;
  sweepMs: number;
  zoneCenter: number;
  zoneWidth: number;
  timeoutMs: number;
  /** The roll is decided up front and hidden from the player until resolve. */
  fish: FishInstance | null;
  junkItemId: string | null;
  baitId: string | null;
}

export interface QuestState {
  id: string;
  progress: number;
  claimed: boolean;
}

export interface GameStats {
  totalCaught: number;
  totalSold: number;
  coinsEarned: number;
  casts: number;
  perfectCasts: number;
  escapes: number;
  bred: number;
  mutations: number;
  giftsSent: number;
  visits: number;
  dailiesCompleted: number;
  biggest: { speciesId: string; sizeCm: number } | null;
}

export interface FishdexEntry {
  count: number;
  maxSize: number;
  bestStars: number;
  firstAt: number;
}

export interface LogEntry {
  at: number;
  kind: "catch" | "sell" | "pond" | "upgrade" | "quest" | "social" | "idle" | "system";
  text: Localized;
}

export interface GameSettings {
  locale: Locale;
  sound: boolean;
  music: boolean;
  theme: "light" | "dark" | "system";
  reducedMotion: boolean;
}

export interface GameState {
  saveVersion: number;
  contentVersion: number;
  createdAt: number;
  lastTickAt: number;
  lastCastAt: number;
  rngSeed: number;

  coins: number;
  pearls: number;
  xp: number;
  level: number;
  skillPoints: number;

  prestige: { count: number; blessing: number };

  zoneId: ZoneId;
  unlockedZones: ZoneId[];

  bag: FishInstance[];
  pond: {
    fish: PondFish[];
    lastFedAt: number;
    /** 0..1 — how fresh the water is. Drops over time, restored by feeding. */
    freshness: number;
  };

  items: Record<string, number>;
  equippedBaitId: string | null;

  upgrades: Record<string, number>;
  skills: Record<string, number>;

  fishdex: Record<string, FishdexEntry>;
  quests: {
    dailyKey: string;
    weeklyKey: string;
    daily: QuestState[];
    weekly: QuestState[];
  };

  achievements: string[];
  stats: GameStats;
  pendingCast: PendingCast | null;
  log: LogEntry[];
  settings: GameSettings;
}

/* ------------------------------------------------------------------- results */

export interface CatchResult {
  outcome: "fish" | "junk" | "escape" | "miss";
  fish: FishInstance | null;
  junkItemId: string | null;
  accuracy: number;
  perfect: boolean;
  bagFull: boolean;
  /** Coins gained when a full bag forced an auto-sell. */
  autoSoldFor: number;
  newSpecies: boolean;
  levelUps: number;
}

export interface IdleReport {
  elapsedMs: number;
  cappedMs: number;
  caught: FishInstance[];
  autoSoldCount: number;
  autoSoldCoins: number;
  pondCoins: number;
  pondPearls: number;
  matured: number;
  eggs: number;
}
