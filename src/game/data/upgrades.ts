import type { Upgrade, UpgradeId } from "@/game/types";

export const UPGRADES: Upgrade[] = [
  {
    id: "rod",
    name: { th: "คันเบ็ด", en: "Rod" },
    blurb: { th: "คันที่สมดุลขึ้นทำให้จับจังหวะง่ายขึ้น", en: "A balanced rod is easier to time." },
    emoji: "🎣",
    maxLevel: 12,
    baseCost: 90,
    costGrowth: 1.55,
    effect: { th: "โซนจับจังหวะ +6%", en: "Timing zone +6%" },
  },
  {
    id: "line",
    name: { th: "สายเบ็ด", en: "Line" },
    blurb: { th: "สายที่เหนียวขึ้นดึงปลาตัวใหญ่ขึ้นมาได้", en: "Tougher line lands bigger fish." },
    emoji: "🧵",
    maxLevel: 12,
    baseCost: 120,
    costGrowth: 1.6,
    effect: { th: "ขนาดปลา +4%", en: "Fish size +4%" },
  },
  {
    id: "reel",
    name: { th: "รีล", en: "Reel" },
    blurb: { th: "รีลลื่นทำให้แถบความตึงเดินช้าลง", en: "A smooth reel slows the tension bar." },
    emoji: "🌀",
    maxLevel: 10,
    baseCost: 160,
    costGrowth: 1.62,
    effect: { th: "แถบช้าลง 4%", en: "Bar 4% slower" },
  },
  {
    id: "creel",
    name: { th: "ตะข้องปลา", en: "Creel" },
    blurb: { th: "ใส่ปลาได้มากขึ้นก่อนต้องขาย", en: "Hold more fish before selling." },
    emoji: "🧺",
    maxLevel: 14,
    baseCost: 70,
    costGrowth: 1.5,
    effect: { th: "ช่องกระเป๋า +4", en: "+4 bag slots" },
  },
  {
    id: "cooler",
    name: { th: "ตู้แช่", en: "Cooler" },
    blurb: { th: "ปลาสดกว่า ขายได้ราคาดีกว่า", en: "Fresher fish, better price." },
    emoji: "🧊",
    maxLevel: 12,
    baseCost: 200,
    costGrowth: 1.65,
    effect: { th: "ราคาขาย +7%", en: "Sell price +7%" },
  },
  {
    id: "lantern",
    name: { th: "ตะเกียงเรือ", en: "Boat Lantern" },
    blurb: { th: "แสงดีขึ้น ปลากลางคืนและน้ำลึกเข้าหามากขึ้น", en: "Better light draws night and deep fish." },
    emoji: "🏮",
    maxLevel: 10,
    baseCost: 340,
    costGrowth: 1.7,
    effect: { th: "โชคกลางคืน/น้ำลึก +8%", en: "Night & deep luck +8%" },
  },
  {
    id: "boat",
    name: { th: "เรือ", en: "Boat" },
    blurb: { th: "เรือที่แข็งแรงพาไปโซนไกลขึ้น", en: "A sturdier boat reaches farther zones." },
    emoji: "🛶",
    maxLevel: 4,
    baseCost: 1800,
    costGrowth: 3.4,
    effect: { th: "ปลดล็อกโซนถัดไป", en: "Unlocks the next zone" },
  },
  {
    id: "helper",
    name: { th: "แมวลูกเรือ", en: "Deck Cat" },
    blurb: {
      th: "เปิดตกอัตโนมัติได้ และยังตกให้ตอนคุณไม่อยู่",
      en: "Unlocks auto-fishing, and keeps casting while you're away.",
    },
    emoji: "🐈",
    maxLevel: 12,
    baseCost: 500,
    costGrowth: 1.72,
    effect: {
      th: "รอบตกอัตโนมัติและออฟไลน์เร็วขึ้น",
      en: "Faster auto & offline casts",
    },
  },
  {
    id: "rack",
    name: { th: "แผงตากปลา", en: "Drying Rack" },
    blurb: { th: "เก็บผลตอนออฟไลน์ได้นานขึ้น", en: "Banks offline progress for longer." },
    emoji: "🪧",
    maxLevel: 10,
    baseCost: 420,
    costGrowth: 1.68,
    effect: { th: "เพดานออฟไลน์ +2 ชม.", en: "+2h offline cap" },
  },
  {
    id: "charm",
    name: { th: "เครื่องรางนำโชค", en: "Lucky Charm" },
    blurb: { th: "ของขลังจากศาลเจ้าริมทะเล", en: "A trinket from the seaside shrine." },
    emoji: "🧿",
    maxLevel: 10,
    baseCost: 650,
    costGrowth: 1.78,
    effect: { th: "โชค +5%", en: "Luck +5%" },
  },
  {
    id: "pond",
    name: { th: "ขยายบ่อเลี้ยง", en: "Pond Expansion" },
    blurb: { th: "บ่อใหญ่ขึ้น เลี้ยงปลาได้มากขึ้น", en: "A bigger pond holds more fish." },
    emoji: "⛲",
    maxLevel: 10,
    baseCost: 300,
    costGrowth: 1.85,
    effect: { th: "ช่องบ่อ +2", en: "+2 pond slots" },
  },
];

export const UPGRADE_BY_ID: Record<UpgradeId, Upgrade> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
) as Record<UpgradeId, Upgrade>;

export function upgradeCost(id: UpgradeId, currentLevel: number): number {
  const u = UPGRADE_BY_ID[id];
  return Math.round(u.baseCost * Math.pow(u.costGrowth, currentLevel));
}
