// ---------------------------------------------------------------
// 阿森纳 2026-27 赛季球员数据
// 来源：arsenal_2026_27_ratings.xlsx（FM 风格能力值）
// ---------------------------------------------------------------

/** 场上球员 8 维能力 */
export interface OutfieldAttributes {
  defense: number;   // 防守
  physical: number;  // 身体
  pace: number;      // 速度
  vision: number;    // 视野
  attack: number;    // 进攻
  technique: number; // 技术
  aerial: number;    // 制空
  mental: number;    // 精神
  overall: number;   // 综合
}

/** 门将能力 */
export interface GoalkeeperAttributes {
  saving: number;       // 扑救
  coverage: number;     // 覆盖
  reflexes: number;     // 反应
  distribution: number; // 出球
  spectacular: number;  // 神扑
  feet: number;         // 脚下
  aerial: number;       // 制空
  command: number;      // 指挥
  overall: number;      // 综合
}

export type PlayerAttributes = OutfieldAttributes | GoalkeeperAttributes;

export interface SquadPlayer {
  id: string;           // 英文名 slug，用作 URL 参数
  number: number;       // 号码
  name: string;         // 中文全名
  nameEn: string;       // 英文名（短）
  position: string;     // 主位置 (GK / CB / RB / LB / DM / CM / AM / RW / LW / ST)
  positions: string[];  // 可打位置列表
  nationality: string;  // 国籍
  birthDate?: string;   // 出生日期（可选，留空则不显示年龄）
  status?: "fit" | "injured" | "suspended" | "resting"; // 状态
  attributes: PlayerAttributes;
  /** 赛季统计（占位——后续从 API/DB 填充） */
  seasonStats: {
    appearances: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    rating: number;
  } | null;
}

// ---- 场上球员数据（按号码排序）----

export const SQUAD_PLAYERS: SquadPlayer[] = [
  {
    id: "david-raya",
    number: 1,
    name: "大卫·拉亚",
    nameEn: "David Raya",
    position: "GK",
    positions: ["GK"],
    nationality: "西班牙",
    status: "fit",
    attributes: {
      saving: 17, coverage: 13, reflexes: 15,
      distribution: 17, spectacular: 14, feet: 16,
      aerial: 14, command: 16, overall: 15.3,
    },
    seasonStats: { appearances: 394, goals: 0, assists: 0, yellowCards: 0, redCards: 0, rating: 7.07 },
  },
  {
    id: "william-saliba",
    number: 2,
    name: "威廉·萨利巴",
    nameEn: "William Saliba",
    position: "CB",
    positions: ["CB"],
    nationality: "法国",
    status: "fit",
    attributes: {
      defense: 18, physical: 17, pace: 14, vision: 13,
      attack: 9, technique: 15, aerial: 17, mental: 17, overall: 15,
    },
    seasonStats: { appearances: 341, goals: 38, assists: 0, yellowCards: 0, redCards: 0, rating: 7.06 },
  },
  {
    id: "gabriel-magalhaes",
    number: 6,
    name: "加布里埃尔·马加良斯",
    nameEn: "Gabriel",
    position: "CB",
    positions: ["CB"],
    nationality: "巴西",
    status: "fit",
    attributes: {
      defense: 17, physical: 17, pace: 12, vision: 11,
      attack: 12, technique: 13, aerial: 19, mental: 16, overall: 14.625,
    },
    seasonStats: { appearances: 204, goals: 20, assists: 0, yellowCards: 0, redCards: 0, rating: 7.07 },
  },
  {
    id: "piero-hincapie",
    number: 5,
    name: "皮耶罗·因卡皮耶",
    nameEn: "Hincapié",
    position: "CB",
    positions: ["CB", "LB"],
    nationality: "厄瓜多尔",
    status: "fit",
    attributes: {
      defense: 16, physical: 15, pace: 15, vision: 12,
      attack: 7, technique: 15, aerial: 14, mental: 14, overall: 13.5,
    },
    seasonStats: null,
  },
  {
    id: "ben-white",
    number: 4,
    name: "本·怀特",
    nameEn: "White",
    position: "RB",
    positions: ["RB", "CB"],
    nationality: "英格兰",
    status: "fit",
    attributes: {
      defense: 15, physical: 14, pace: 13, vision: 13,
      attack: 7, technique: 15, aerial: 12, mental: 15, overall: 13,
    },
    seasonStats: null,
  },
  {
    id: "jurrien-timber",
    number: 12,
    name: "尤里恩·廷贝尔",
    nameEn: "Timber",
    position: "RB",
    positions: ["RB", "CB"],
    nationality: "荷兰",
    status: "fit",
    attributes: {
      defense: 15, physical: 13, pace: 15, vision: 14,
      attack: 12, technique: 16, aerial: 12, mental: 15, overall: 14,
    },
    seasonStats: { appearances: 279, goals: 2, assists: 0, yellowCards: 0, redCards: 0, rating: 7.08 },
  },
  {
    id: "riccardo-calafiori",
    number: 33,
    name: "里卡尔多·卡拉菲奥里",
    nameEn: "Calafiori",
    position: "LB",
    positions: ["LB", "CB"],
    nationality: "意大利",
    status: "fit",
    attributes: {
      defense: 14, physical: 15, pace: 13, vision: 13,
      attack: 12, technique: 15, aerial: 13, mental: 13, overall: 13.5,
    },
    seasonStats: null,
  },
  {
    id: "myles-lewis-skelly",
    number: 49,
    name: "迈尔斯·刘易斯-斯凯利",
    nameEn: "Lewis-Skelly",
    position: "LB",
    positions: ["LB", "CM"],
    nationality: "英格兰",
    status: "fit",
    attributes: {
      defense: 13, physical: 14, pace: 15, vision: 13,
      attack: 9, technique: 16, aerial: 10, mental: 14, overall: 13,
    },
    seasonStats: null,
  },
  {
    id: "ezri-konsa",
    number: 15,
    name: "埃兹里·孔萨",
    nameEn: "Konsa",
    position: "CB",
    positions: ["CB", "RB"],
    nationality: "英格兰",
    status: "fit",
    attributes: {
      defense: 15, physical: 15, pace: 13, vision: 10,
      attack: 7, technique: 12, aerial: 15, mental: 14, overall: 12.625,
    },
    seasonStats: null,
  },
  {
    id: "cristhian-mosquera",
    number: 3,
    name: "克里斯蒂安·莫斯克拉",
    nameEn: "Mosquera",
    position: "CB",
    positions: ["CB"],
    nationality: "西班牙",
    status: "fit",
    attributes: {
      defense: 14, physical: 14, pace: 13, vision: 9,
      attack: 7, technique: 12, aerial: 14, mental: 13, overall: 12,
    },
    seasonStats: null,
  },
  {
    id: "declan-rice",
    number: 41,
    name: "德克兰·赖斯",
    nameEn: "Rice",
    position: "DM",
    positions: ["DM", "CM"],
    nationality: "英格兰",
    status: "fit",
    attributes: {
      defense: 16, physical: 18, pace: 14, vision: 14,
      attack: 12, technique: 14, aerial: 16, mental: 18, overall: 15.25,
    },
    seasonStats: { appearances: 315, goals: 24, assists: 0, yellowCards: 0, redCards: 0, rating: 7.06 },
  },
  {
    id: "bruno-guimaraes",
    number: 39,
    name: "布鲁诺·吉马良斯",
    nameEn: "Bruno G",
    position: "CM",
    positions: ["CM", "DM"],
    nationality: "巴西",
    status: "fit",
    attributes: {
      defense: 15, physical: 16, pace: 12, vision: 15,
      attack: 10, technique: 16, aerial: 13, mental: 17, overall: 14.25,
    },
    seasonStats: null,
  },
  {
    id: "martin-odegaard",
    number: 8,
    name: "马丁·厄德高",
    nameEn: "Ødegaard",
    position: "AM",
    positions: ["AM", "CM"],
    nationality: "挪威",
    status: "resting",
    attributes: {
      defense: 11, physical: 11, pace: 11, vision: 18,
      attack: 16, technique: 18, aerial: 9, mental: 18, overall: 14,
    },
    seasonStats: { appearances: 169, goals: 62, assists: 0, yellowCards: 0, redCards: 0, rating: 7.32 },
  },
  {
    id: "eberechi-eze",
    number: 10,
    name: "埃贝雷基·泽",
    nameEn: "Eze",
    position: "AM",
    positions: ["AM", "LW"],
    nationality: "英格兰",
    status: "fit",
    attributes: {
      defense: 10, physical: 13, pace: 15, vision: 14,
      attack: 14, technique: 17, aerial: 9, mental: 12, overall: 13,
    },
    seasonStats: null,
  },
  {
    id: "mikel-merino",
    number: 23,
    name: "米克尔·梅里诺",
    nameEn: "Merino",
    position: "CM",
    positions: ["CM", "ST"],
    nationality: "西班牙",
    status: "fit",
    attributes: {
      defense: 13, physical: 16, pace: 10, vision: 12,
      attack: 12, technique: 13, aerial: 18, mental: 14, overall: 13.5,
    },
    seasonStats: null,
  },
  {
    id: "martin-zubimendi",
    number: 36,
    name: "马丁·苏维门迪",
    nameEn: "Zubimendi",
    position: "DM",
    positions: ["DM"],
    nationality: "西班牙",
    status: "fit",
    attributes: {
      defense: 15, physical: 13, pace: 11, vision: 16,
      attack: 10, technique: 17, aerial: 11, mental: 14, overall: 13.375,
    },
    seasonStats: null,
  },
  {
    id: "max-dowman",
    number: 22,
    name: "马克斯·道曼",
    nameEn: "Dowman",
    position: "AM",
    positions: ["AM", "RW"],
    nationality: "英格兰",
    status: "fit",
    attributes: {
      defense: 9, physical: 11, pace: 15, vision: 14,
      attack: 12, technique: 16, aerial: 9, mental: 12, overall: 12.25,
    },
    seasonStats: null,
  },
  {
    id: "bukayo-saka",
    number: 7,
    name: "布卡约·萨卡",
    nameEn: "Saka",
    position: "RW",
    positions: ["RW"],
    nationality: "英格兰",
    status: "fit",
    attributes: {
      defense: 11, physical: 13, pace: 17, vision: 16,
      attack: 17, technique: 18, aerial: 10, mental: 18, overall: 15,
    },
    seasonStats: { appearances: 363, goals: 122, assists: 0, yellowCards: 0, redCards: 0, rating: 7.35 },
  },
  {
    id: "viktor-gyokeres",
    number: 14,
    name: "维克托·约克雷斯",
    nameEn: "Gyökeres",
    position: "ST",
    positions: ["ST"],
    nationality: "瑞典",
    status: "fit",
    attributes: {
      defense: 8, physical: 16, pace: 14, vision: 11,
      attack: 18, technique: 14, aerial: 16, mental: 15, overall: 14,
    },
    seasonStats: { appearances: 275, goals: 216, assists: 0, yellowCards: 0, redCards: 0, rating: 7.43 },
  },
  {
    id: "kai-havertz",
    number: 29,
    name: "凯·哈弗茨",
    nameEn: "Havertz",
    position: "ST",
    positions: ["ST", "CM"],
    nationality: "德国",
    status: "fit",
    attributes: {
      defense: 12, physical: 16, pace: 12, vision: 13,
      attack: 16, technique: 15, aerial: 16, mental: 16, overall: 14.5,
    },
    seasonStats: { appearances: 295, goals: 119, assists: 0, yellowCards: 0, redCards: 0, rating: 7.23 },
  },
  {
    id: "gabriel-jesus",
    number: 9,
    name: "加布里埃尔·赫苏斯",
    nameEn: "Jesus",
    position: "ST",
    positions: ["ST", "W"],
    nationality: "巴西",
    status: "resting",
    attributes: {
      defense: 10, physical: 13, pace: 15, vision: 14,
      attack: 12, technique: 17, aerial: 11, mental: 14, overall: 13.25,
    },
    seasonStats: { appearances: 225, goals: 157, assists: 0, yellowCards: 0, redCards: 0, rating: 7.21 },
  },
  {
    id: "noni-madueke",
    number: 20,
    name: "诺尼·马杜埃凯",
    nameEn: "Madueke",
    position: "RW",
    positions: ["RW", "LW"],
    nationality: "英格兰",
    status: "fit",
    attributes: {
      defense: 10, physical: 13, pace: 17, vision: 12,
      attack: 13, technique: 15, aerial: 9, mental: 12, overall: 12.625,
    },
    seasonStats: null,
  },
  {
    id: "christos-tzolis",
    number: 17,
    name: "克里斯托斯·佐利斯",
    nameEn: "Tzolis",
    position: "LW",
    positions: ["LW", "RW"],
    nationality: "希腊",
    status: "fit",
    attributes: {
      defense: 11, physical: 13, pace: 16, vision: 13,
      attack: 15, technique: 16, aerial: 9, mental: 14, overall: 13.375,
    },
    seasonStats: null,
  },
  {
    id: "gabriel-martinelli",
    number: 0,
    name: "加布里埃尔·马丁内利",
    nameEn: "Martinelli",
    position: "LW",
    positions: ["LW"],
    nationality: "巴西",
    status: "fit",
    attributes: {
      defense: 10, physical: 13, pace: 17, vision: 14,
      attack: 15, technique: 16, aerial: 8, mental: 14, overall: 13,
    },
    seasonStats: { appearances: 341, goals: 117, assists: 0, yellowCards: 0, redCards: 0, rating: 7.33 },
  },
  {
    id: "kepa-arrizabalaga",
    number: 13,
    name: "凯帕·阿里萨瓦拉加",
    nameEn: "Kepa",
    position: "GK",
    positions: ["GK"],
    nationality: "西班牙",
    status: "fit",
    attributes: {
      saving: 14, coverage: 12, reflexes: 13,
      distribution: 14, spectacular: 11, feet: 14,
      aerial: 12, command: 11, overall: 12.6,
    },
    seasonStats: null,
  },
  {
    id: "illan-meslier",
    number: 30,
    name: "伊兰·梅斯利耶",
    nameEn: "Meslier",
    position: "GK",
    positions: ["GK"],
    nationality: "法国",
    status: "fit",
    attributes: {
      saving: 14, coverage: 15, reflexes: 12,
      distribution: 12, spectacular: 11, feet: 12,
      aerial: 14, command: 11, overall: 12.6,
    },
    seasonStats: null,
  },
];

/** 判断是否为门将 */
export function isGoalkeeper(p: SquadPlayer): p is SquadPlayer & { attributes: GoalkeeperAttributes } {
  return p.position === "GK";
}

/** 获取场上球员的 8 维属性（门将返回 null） */
export function getOutfieldAttrs(p: SquadPlayer): OutfieldAttributes | null {
  if (isGoalkeeper(p)) return null;
  return p.attributes as OutfieldAttributes;
}

/** 按 ID 查找球员 */
export function getPlayerById(id: string): SquadPlayer | undefined {
  return SQUAD_PLAYERS.find((p) => p.id === id);
}

/** 阵型位置映射 —— 4-3-3 首发阵容 */
export interface FormationSlot {
  label: string;        // 显示标签如 "ST (C)"
  positionKey: string;  // 位置键
  x: number;            // 足球场上的 x% (0-100)
  y: number;            // 足球场上的 y% (0-100)
  playerId?: string;    // 填入的球员 ID
}

export const FORMATION_433: FormationSlot[] = [
  // ST
  { label: "ST (C)", positionKey: "ST", x: 50, y: 10 },
  // AM line
  { label: "AM (R)", positionKey: "RW", x: 78, y: 28 },
  { label: "AM (C)", positionKey: "AM", x: 50, y: 30 },
  { label: "AM (L)", positionKey: "LW", x: 22, y: 28 },
  // DM line
  { label: "DM (R)", positionKey: "DM", x: 72, y: 50 },
  { label: "DM (C)", positionKey: "DM", x: 50, y: 52 },
  { label: "DM (L)", positionKey: "DM", x: 28, y: 50 },
  // Defense line
  { label: "D (R)", positionKey: "RB", x: 83, y: 75 },
  { label: "D (CR)", positionKey: "CB", x: 62, y: 77 },
  { label: "D (CL)", positionKey: "CB", x: 38, y: 77 },
  { label: "D (L)", positionKey: "LB", x: 17, y: 75 },
  // GK
  { label: "GK", positionKey: "GK", x: 50, y: 92 },
];

/** 自动将球员填入 4-3-3 阵型（按主位置最佳匹配） */
export function autoFillFormation(): (FormationSlot & { player?: SquadPlayer })[] {
  const remaining = [...SQUAD_PLAYERS];
  const filled = FORMATION_433.map((slot) => ({ ...slot, player: undefined as SquadPlayer | undefined }));

  // 匹配函数：找位置最匹配的球员
  const pick = (key: string) => {
    const idx = remaining.findIndex((p) =>
      p.positions.some((pos) => pos === key || pos.includes(key) || key.includes(pos))
    );
    if (idx >= 0) {
      const p = remaining.splice(idx, 1)[0];
      const slot = filled.find((s) => s.positionKey === key && !s.player);
      if (slot) slot.player = p;
      return p;
    }
    return undefined;
  };

  // 按阵型顺序填充
  pick("ST");
  pick("RW"); pick("AM"); pick("LW");
  pick("DM"); pick("DM"); pick("DM");
  pick("RB"); pick("CB"); pick("CB"); pick("LB");
  pick("GK");

  return filled;
}
