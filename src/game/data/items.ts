import type { Item } from "@/game/types";

export const ITEMS: Item[] = [
  /* ------------------------------------------------------------- baits */
  {
    id: "bait_worm",
    kind: "bait",
    name: { th: "ไส้เดือนสวนครัว", en: "Garden Worm" },
    emoji: "🪱",
    buy: 4,
    sell: 1,
    bait: { luck: 0, sizeBonus: 0 },
  },
  {
    id: "bait_shrimp",
    kind: "bait",
    name: { th: "กุ้งฝอย", en: "Tiny Shrimp" },
    emoji: "🦐",
    buy: 16,
    sell: 6,
    bait: { luck: 0.08, sizeBonus: 0.04 },
  },
  {
    id: "bait_lure",
    kind: "bait",
    name: { th: "เหยื่อปลอมเงาวับ", en: "Flashing Lure" },
    emoji: "🪝",
    buy: 44,
    sell: 16,
    bait: { luck: 0.05, sizeBonus: 0.16 },
  },
  {
    id: "bait_glow",
    kind: "bait",
    name: { th: "เหยื่อเรืองแสง", en: "Glowbait" },
    emoji: "🔆",
    buy: 130,
    sell: 48,
    bait: {
      luck: 0.2,
      sizeBonus: 0.08,
      boostZones: ["deep", "reef"],
      boostTime: ["night", "dusk"],
    },
  },
  {
    id: "bait_royal",
    kind: "bait",
    name: { th: "เหยื่อสูตรราชา", en: "Royal Bait" },
    emoji: "👑",
    buy: 520,
    sell: 180,
    bait: { luck: 0.42, sizeBonus: 0.22 },
  },

  /* -------------------------------------------------------------- food */
  {
    id: "food_basic",
    kind: "food",
    name: { th: "อาหารเม็ดธรรมดา", en: "Plain Pellets" },
    emoji: "🥣",
    buy: 20,
    sell: 6,
    food: { growthMultiplier: 1, freshness: 0.45 },
  },
  {
    id: "food_premium",
    kind: "food",
    name: { th: "อาหารเกรดพรีเมียม", en: "Premium Flakes" },
    emoji: "🍱",
    buy: 90,
    sell: 30,
    food: { growthMultiplier: 1.35, freshness: 0.75 },
  },
  {
    id: "food_royal",
    kind: "food",
    name: { th: "อาหารสูตรพิเศษคุณยาย", en: "Grandma's Recipe" },
    emoji: "🍯",
    buy: 340,
    sell: 120,
    food: { growthMultiplier: 1.8, freshness: 1 },
  },

  /* --------------------------------------------------------- materials */
  {
    id: "mat_boot",
    kind: "material",
    name: { th: "รองเท้าบูตขาด", en: "Old Boot" },
    emoji: "🥾",
    buy: null,
    sell: 6,
  },
  {
    id: "mat_can",
    kind: "material",
    name: { th: "กระป๋องสนิม", en: "Rusty Can" },
    emoji: "🥫",
    buy: null,
    sell: 9,
  },
  {
    id: "mat_driftwood",
    kind: "material",
    name: { th: "ขอนไม้ลอยน้ำ", en: "Driftwood" },
    emoji: "🪵",
    buy: null,
    sell: 22,
  },
  {
    id: "mat_shell",
    kind: "material",
    name: { th: "เปลือกหอยสวย", en: "Pretty Shell" },
    emoji: "🐚",
    buy: null,
    sell: 55,
  },
  {
    id: "mat_bottle",
    kind: "material",
    name: { th: "ขวดจดหมายเก่า", en: "Message in a Bottle" },
    emoji: "🍾",
    buy: null,
    sell: 240,
  },
];

export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i]),
);

export const BAITS = ITEMS.filter((i) => i.kind === "bait");
export const FOODS = ITEMS.filter((i) => i.kind === "food");

/** Junk pulled out of the water, weighted. Keeps early zones honest. */
export const JUNK_TABLE: { itemId: string; weight: number }[] = [
  { itemId: "mat_boot", weight: 40 },
  { itemId: "mat_can", weight: 34 },
  { itemId: "mat_driftwood", weight: 18 },
  { itemId: "mat_shell", weight: 7 },
  { itemId: "mat_bottle", weight: 1 },
];
