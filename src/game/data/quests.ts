import type { Achievement, Quest } from "@/game/types";

export const QUESTS: Quest[] = [
  /* ------------------------------------------------------------- daily */
  {
    id: "d_catch",
    period: "daily",
    metric: "catch",
    target: 15,
    name: { th: "ตกปลาให้ได้ 15 ตัว", en: "Catch 15 fish" },
    reward: { coins: 260, xp: 40 },
  },
  {
    id: "d_sell",
    period: "daily",
    metric: "sell",
    target: 12,
    name: { th: "ขายปลา 12 ตัว", en: "Sell 12 fish" },
    reward: { coins: 220, xp: 35 },
  },
  {
    id: "d_coins",
    period: "daily",
    metric: "coins",
    target: 900,
    name: { th: "หาเหรียญให้ได้ 900", en: "Earn 900 coins" },
    reward: { coins: 300, xp: 45, item: { id: "bait_shrimp", qty: 5 } },
  },
  {
    id: "d_feed",
    period: "daily",
    metric: "feed",
    target: 1,
    name: { th: "ให้อาหารปลาในบ่อ", en: "Feed the pond" },
    reward: { coins: 150, xp: 25 },
  },
  {
    id: "d_stock",
    period: "daily",
    metric: "stock",
    target: 3,
    name: { th: "ปล่อยปลาลงบ่อ 3 ตัว", en: "Stock 3 fish in the pond" },
    reward: { coins: 180, xp: 30 },
  },
  {
    id: "d_rare",
    period: "daily",
    metric: "rare",
    target: 1,
    name: { th: "ตกปลาหายากให้ได้ 1 ตัว", en: "Catch a rare fish" },
    reward: { coins: 420, xp: 70, pearls: 1 },
  },
  {
    id: "d_visit",
    period: "daily",
    metric: "visit",
    target: 1,
    name: { th: "ไปเยี่ยมบ่อเพื่อน", en: "Visit a friend's pond" },
    reward: { coins: 200, xp: 40, item: { id: "food_basic", qty: 2 } },
  },

  /* ------------------------------------------------------------ weekly */
  {
    id: "w_catch",
    period: "weekly",
    metric: "catch",
    target: 140,
    name: { th: "ตกปลารวม 140 ตัว", en: "Catch 140 fish" },
    reward: { coins: 2600, xp: 320, pearls: 3 },
  },
  {
    id: "w_coins",
    period: "weekly",
    metric: "coins",
    target: 12000,
    name: { th: "หาเหรียญรวม 12,000", en: "Earn 12,000 coins" },
    reward: { coins: 3200, xp: 380, pearls: 3 },
  },
  {
    id: "w_daily",
    period: "weekly",
    metric: "dailyDone",
    target: 12,
    name: { th: "ทำเควสรายวันสำเร็จ 12 อัน", en: "Finish 12 daily quests" },
    reward: { coins: 2800, xp: 300, item: { id: "bait_royal", qty: 3 } },
  },
  {
    id: "w_breed",
    period: "weekly",
    metric: "breed",
    target: 3,
    name: { th: "ผสมพันธุ์ปลา 3 ครั้ง", en: "Breed 3 times" },
    reward: { coins: 2400, xp: 260, pearls: 4 },
  },
  {
    id: "w_epic",
    period: "weekly",
    metric: "epic",
    target: 3,
    name: { th: "ตกปลาหายากมากขึ้นไป 3 ตัว", en: "Catch 3 epic-or-better fish" },
    reward: { coins: 4200, xp: 420, pearls: 6 },
  },
  {
    id: "w_gift",
    period: "weekly",
    metric: "gift",
    target: 5,
    name: { th: "ส่งของขวัญให้เพื่อน 5 ครั้ง", en: "Send 5 gifts" },
    reward: { coins: 1800, xp: 220, item: { id: "food_premium", qty: 4 } },
  },
];

export const DAILY_QUESTS = QUESTS.filter((q) => q.period === "daily");
export const WEEKLY_QUESTS = QUESTS.filter((q) => q.period === "weekly");
export const QUEST_BY_ID: Record<string, Quest> = Object.fromEntries(
  QUESTS.map((q) => [q.id, q]),
);

/** Dailies rotate: 4 of the 7 are active each day, picked from the date key. */
export const DAILY_SLOTS = 4;

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_cast",
    name: { th: "เหวี่ยงครั้งแรก", en: "First Cast" },
    blurb: { th: "เหวี่ยงเบ็ดครั้งแรกในชีวิต", en: "Make your very first cast." },
    emoji: "🎣",
    reward: { coins: 50, pearls: 0 },
  },
  {
    id: "catch_10",
    name: { th: "มือใหม่หัดตก", en: "Getting the Hang of It" },
    blurb: { th: "ตกปลาได้ 10 ตัว", en: "Catch 10 fish." },
    emoji: "🐟",
    reward: { coins: 150, pearls: 0 },
  },
  {
    id: "catch_250",
    name: { th: "ขาประจำท่าเรือ", en: "Dock Regular" },
    blurb: { th: "ตกปลาได้ 250 ตัว", en: "Catch 250 fish." },
    emoji: "⚓",
    reward: { coins: 1200, pearls: 2 },
  },
  {
    id: "catch_2000",
    name: { th: "ตำนานท่าเรือ", en: "Harbour Legend" },
    blurb: { th: "ตกปลาได้ 2,000 ตัว", en: "Catch 2,000 fish." },
    emoji: "🏆",
    reward: { coins: 12000, pearls: 10 },
  },
  {
    id: "dex_10",
    name: { th: "สมุดเริ่มมีสีสัน", en: "A Colourful Notebook" },
    blurb: { th: "บันทึกปลา 10 ชนิด", en: "Record 10 species." },
    emoji: "📗",
    reward: { coins: 400, pearls: 1 },
  },
  {
    id: "dex_25",
    name: { th: "นักสะสมตัวจริง", en: "True Collector" },
    blurb: { th: "บันทึกปลา 25 ชนิด", en: "Record 25 species." },
    emoji: "📚",
    reward: { coins: 3000, pearls: 4 },
  },
  {
    id: "dex_all",
    name: { th: "สมุดปลาสมบูรณ์", en: "Complete Fishdex" },
    blurb: { th: "บันทึกปลาครบทุกชนิด", en: "Record every species." },
    emoji: "🌟",
    reward: { coins: 150000, pearls: 60 },
  },
  {
    id: "first_legendary",
    name: { th: "แตะขอบตำนาน", en: "Touching Legend" },
    blurb: { th: "ตกปลาระดับตำนานได้ตัวแรก", en: "Land your first legendary." },
    emoji: "✨",
    reward: { coins: 5000, pearls: 5 },
  },
  {
    id: "first_mutation",
    name: { th: "เกล็ดไม่เหมือนใคร", en: "Unusual Scales" },
    blurb: { th: "ตกปลากลายพันธุ์ได้ตัวแรก", en: "Land your first mutation." },
    emoji: "🌈",
    reward: { coins: 2500, pearls: 3 },
  },
  {
    id: "pond_full",
    name: { th: "บ่อคับคั่ง", en: "A Busy Pond" },
    blurb: {
      th: "ขยายบ่อถึง 10 ช่องแล้วเลี้ยงปลาเต็มบ่อ",
      en: "Fill every slot of a pond upgraded to 10 or more.",
    },
    emoji: "⛲",
    reward: { coins: 1500, pearls: 2 },
  },
  {
    id: "breeder_1",
    name: { th: "ลูกปลาตัวแรก", en: "First Fry" },
    blurb: { th: "ผสมพันธุ์ปลาสำเร็จครั้งแรก", en: "Breed your first fry." },
    emoji: "🧬",
    reward: { coins: 800, pearls: 1 },
  },
  {
    id: "perfect_25",
    name: { th: "จังหวะเป๊ะ", en: "Perfect Timing" },
    blurb: { th: "จับจังหวะแบบเป๊ะ 25 ครั้ง", en: "Hit 25 perfect casts." },
    emoji: "🎯",
    reward: { coins: 1600, pearls: 2 },
  },
  {
    id: "zone_sea",
    name: { th: "ออกทะเลใหญ่", en: "Out to Sea" },
    blurb: { th: "ปลดล็อกทะเลเปิด", en: "Unlock the Open Sea." },
    emoji: "⛵",
    reward: { coins: 2000, pearls: 2 },
  },
  {
    id: "zone_reef",
    name: { th: "ใต้แสงจันทร์", en: "Under Moonlight" },
    blurb: { th: "ปลดล็อกแนวปะการังแสงจันทร์", en: "Unlock the Moonlit Reef." },
    emoji: "🌙",
    reward: { coins: 30000, pearls: 15 },
  },
  {
    id: "friend_1",
    name: { th: "เพื่อนร่วมท่า", en: "Fishing Buddy" },
    blurb: { th: "เพิ่มเพื่อนคนแรก", en: "Add your first friend." },
    emoji: "🤝",
    reward: { coins: 500, pearls: 1 },
  },
  {
    id: "prestige_1",
    name: { th: "ปล่อยปลากลับทะเล", en: "Release to the Sea" },
    blurb: { th: "เริ่มต้นใหม่พร้อมพรจากทะเลครั้งแรก", en: "Take your first Sea Blessing." },
    emoji: "🕊️",
    reward: { coins: 0, pearls: 10 },
  },
];

export const ACHIEVEMENT_BY_ID: Record<string, Achievement> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);
