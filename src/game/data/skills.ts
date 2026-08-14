import type { Skill, SkillId } from "@/game/types";

export const SKILLS: Skill[] = [
  {
    id: "luck",
    name: { th: "โชคของนักตกปลา", en: "Angler's Luck" },
    blurb: { th: "โอกาสเจอปลาหายาก +3% ต่อระดับ", en: "+3% rare bite chance per level" },
    emoji: "🍀",
    maxLevel: 5,
  },
  {
    id: "patience",
    name: { th: "ความอดทน", en: "Patience" },
    blurb: { th: "โซนจับจังหวะกว้างขึ้น 5% ต่อระดับ", en: "+5% timing zone per level" },
    emoji: "🧘",
    maxLevel: 5,
  },
  {
    id: "swift",
    name: { th: "มือไว", en: "Swift Hands" },
    blurb: { th: "เหวี่ยงเบ็ดถี่ขึ้น 6% ต่อระดับ", en: "-6% cast cooldown per level" },
    emoji: "💨",
    maxLevel: 5,
  },
  {
    id: "keeper",
    name: { th: "คนเลี้ยงปลา", en: "Fishkeeper" },
    blurb: { th: "ปลาในบ่อโตเร็วขึ้น 10% ต่อระดับ", en: "+10% pond growth per level" },
    emoji: "🪴",
    maxLevel: 5,
  },
  {
    id: "merchant",
    name: { th: "พ่อค้าเจ้าเล่ห์", en: "Shrewd Merchant" },
    blurb: { th: "ราคาขาย +6% ต่อระดับ", en: "+6% sell price per level" },
    emoji: "💰",
    maxLevel: 5,
  },
  {
    id: "breeder",
    name: { th: "นักผสมพันธุ์", en: "Breeder" },
    blurb: { th: "โอกาสได้ปลากลายพันธุ์ +2% ต่อระดับ", en: "+2% mutation chance per level" },
    emoji: "🧬",
    maxLevel: 5,
  },
  {
    id: "dreamer",
    name: { th: "นักฝันกลางคืน", en: "Night Dreamer" },
    blurb: { th: "เพดานออฟไลน์ +3 ชม. ต่อระดับ", en: "+3h offline cap per level" },
    emoji: "🌜",
    maxLevel: 3,
  },
];

export const SKILL_BY_ID: Record<SkillId, Skill> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s]),
) as Record<SkillId, Skill>;
