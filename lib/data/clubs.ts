// ---------------------------------------------------------------
// 俱乐部身份表：中文名 + 3 字母缩写 + 品牌色
// 用途：队标字母章（ClubBadge）与全站队名中文化。
//
// 配色取自设计稿 docs/design-spec-from-sketch.md —— 设计稿用的是
// 「俱乐部品牌色直角方章 + 3 字母缩写」，颜色尽量贴近真实品牌色，
// 但对纯白/纯黑/高亮黄这类在深色底上不可读的队色做了压暗处理。
// ---------------------------------------------------------------

export interface ClubIdentity {
  /** 中文队名 */
  nameZh: string;
  /** 3 字母缩写（队标章上的文字） */
  code: string;
  /** 品牌色（队标章底色） */
  color: string;
}

/** 去掉 FC / AFC / CF 等后缀，让 football-data 与 arsenal.com 的命名收敛到一起 */
const CLUB_SUFFIX = /\s+(FC|AFC|CF|SC|AC|SAD|CP|BK|FK)$/i;

export function normalizeClubName(raw: string): string {
  return raw.replace(CLUB_SUFFIX, "").replace(/\s+/g, " ").trim();
}

/** 少量异构写法归一到主键 */
const ALIASES: Record<string, string> = {
  "Brighton and Hove Albion": "Brighton & Hove Albion",
  "Brighton Hove": "Brighton & Hove Albion",
  Wolves: "Wolverhampton Wanderers",
  "Man City": "Manchester City",
  "Man United": "Manchester United",
  "Manchester Utd": "Manchester United",
  Tottenham: "Tottenham Hotspur",
  "Nottingham": "Nottingham Forest",
  Inter: "Internazionale",
  "Atletico de Madrid": "Atlético de Madrid",
  "Bayern Munich": "Bayern München",
  "Slavia Prague": "Slavia Praha",
  "Sparta Prague": "Sparta Praha",
  "Paris SG": "Paris Saint-Germain",
  "PSG": "Paris Saint-Germain",
  "Sporting Lisbon": "Sporting CP",
  "Shakhtar": "Shakhtar Donetsk",
  "Dinamo": "Dinamo Zagreb",
  "Crvena Zvezda": "Red Star Belgrade",
  "BSC Young Boys": "Young Boys",
  "SK Sturm Graz": "Sturm Graz",
  "LOSC Lille": "Lille",
  "Stade Brestois": "Brest",
  "Stade Rennais": "Rennes",
  "AS Monaco": "Monaco",
  "Olympique Lyon": "Lyon",
  "Olympique Marseille": "Marseille",
  "OGC Nice": "Nice",
  "RC Lens": "Lens",
  "SSC Napoli": "Napoli",
  "SS Lazio": "Lazio",
  "AS Roma": "Roma",
  "Atalanta BC": "Atalanta",
  "ACF Fiorentina": "Fiorentina",
  "Club Atletico de Madrid": "Atlético de Madrid",
  "FC Bayern Munich": "Bayern München",
  "Real Madrid CF": "Real Madrid",
  "FC Barcelona": "Barcelona",
  "FC Porto": "Porto",
  "SL Benfica": "Benfica",
  "FC Salzburg": "RB Salzburg",
  "Union SG": "Union Saint-Gilloise",
  "Bayer Leverkusen": "Leverkusen",
  "Eintracht Frankfurt": "Frankfurt",
  "Athletic Club": "Athletic Bilbao",
  "Real Sociedad": "Real Sociedad",
  "Real Betis": "Real Betis",
};

const CLUBS: Record<string, ClubIdentity> = {
  /* ---- 英超 ---- */
  "Arsenal": { nameZh: "阿森纳", code: "ARS", color: "#E4002B" },
  "Manchester City": { nameZh: "曼城", code: "MCI", color: "#4B94D0" },
  "Liverpool": { nameZh: "利物浦", code: "LIV", color: "#C8102E" },
  "Tottenham Hotspur": { nameZh: "托特纳姆热刺", code: "TOT", color: "#132257" },
  "Chelsea": { nameZh: "切尔西", code: "CHE", color: "#034694" },
  "Aston Villa": { nameZh: "阿斯顿维拉", code: "AVL", color: "#670E36" },
  "Newcastle United": { nameZh: "纽卡斯尔联", code: "NEW", color: "#241F20" },
  "Manchester United": { nameZh: "曼联", code: "MUN", color: "#DA291C" },
  "West Ham United": { nameZh: "西汉姆联", code: "WHU", color: "#7A263A" },
  "Crystal Palace": { nameZh: "水晶宫", code: "CRY", color: "#1B458F" },
  "Brentford": { nameZh: "布伦特福德", code: "BRE", color: "#C8102E" },
  "Wolverhampton Wanderers": { nameZh: "狼队", code: "WOL", color: "#C99700" },
  "Fulham": { nameZh: "富勒姆", code: "FUL", color: "#6E6E7A" },
  "AFC Bournemouth": { nameZh: "伯恩茅斯", code: "BOU", color: "#DA291C" },
  "Bournemouth": { nameZh: "伯恩茅斯", code: "BOU", color: "#DA291C" },
  "Everton": { nameZh: "埃弗顿", code: "EVE", color: "#1F4FA8" },
  "Brighton & Hove Albion": { nameZh: "布莱顿", code: "BHA", color: "#0057B8" },
  "Nottingham Forest": { nameZh: "诺丁汉森林", code: "NFO", color: "#C8102E" },
  "Sunderland": { nameZh: "桑德兰", code: "SUN", color: "#EB172B" },
  "Leeds United": { nameZh: "利兹联", code: "LEE", color: "#C99700" },
  "Burnley": { nameZh: "伯恩利", code: "BUR", color: "#6C1D45" },
  "Coventry City": { nameZh: "考文垂", code: "COV", color: "#4B94D0" },
  "Hull City": { nameZh: "赫尔城", code: "HUL", color: "#F18A01" },
  "Ipswich Town": { nameZh: "伊普斯维奇", code: "IPS", color: "#3A64A3" },
  "Southampton": { nameZh: "南安普顿", code: "SOU", color: "#D71920" },
  "Leicester City": { nameZh: "莱斯特城", code: "LEI", color: "#003090" },
  "Sheffield United": { nameZh: "谢菲尔德联", code: "SHU", color: "#EE2737" },
  "West Bromwich Albion": { nameZh: "西布罗姆维奇", code: "WBA", color: "#122F67" },
  "Watford": { nameZh: "沃特福德", code: "WAT", color: "#FBEE23" },

  /* ---- 欧陆 ---- */
  "Real Madrid": { nameZh: "皇家马德里", code: "RMA", color: "#8A6A16" },
  "Barcelona": { nameZh: "巴塞罗那", code: "BAR", color: "#A50044" },
  "Atlético de Madrid": { nameZh: "马德里竞技", code: "ATM", color: "#CB3524" },
  "Athletic Bilbao": { nameZh: "毕尔巴鄂竞技", code: "ATH", color: "#EE2523" },
  "Real Sociedad": { nameZh: "皇家社会", code: "RSO", color: "#0067B1" },
  "Real Betis": { nameZh: "皇家贝蒂斯", code: "BET", color: "#00954C" },
  "Villarreal": { nameZh: "比利亚雷亚尔", code: "VIL", color: "#FFE667" },
  "Valencia": { nameZh: "瓦伦西亚", code: "VAL", color: "#EE3524" },
  "Sevilla": { nameZh: "塞维利亚", code: "SEV", color: "#D81920" },
  "Girona": { nameZh: "赫罗纳", code: "GIR", color: "#CD2534" },
  "Bayern München": { nameZh: "拜仁慕尼黑", code: "FCB", color: "#DC052D" },
  "Borussia Dortmund": { nameZh: "多特蒙德", code: "BVB", color: "#8A6A16" },
  "Leverkusen": { nameZh: "勒沃库森", code: "B04", color: "#E32219" },
  "RB Leipzig": { nameZh: "RB莱比锡", code: "RBL", color: "#DD0741" },
  "Frankfurt": { nameZh: "法兰克福", code: "SGE", color: "#E1000F" },
  "VfB Stuttgart": { nameZh: "斯图加特", code: "VFB", color: "#E32219" },
  "Union Berlin": { nameZh: "柏林联合", code: "FCU", color: "#EB1923" },
  "Paris Saint-Germain": { nameZh: "巴黎圣日耳曼", code: "PSG", color: "#004170" },
  "Monaco": { nameZh: "摩纳哥", code: "ASM", color: "#E63312" },
  "Marseille": { nameZh: "马赛", code: "OM", color: "#2FAEE0" },
  "Lyon": { nameZh: "里昂", code: "OL", color: "#1B3E8B" },
  "Lille": { nameZh: "里尔", code: "LIL", color: "#E01E13" },
  "Rennes": { nameZh: "雷恩", code: "SRFC", color: "#E23A2E" },
  "Nice": { nameZh: "尼斯", code: "OGCN", color: "#C8102E" },
  "Lens": { nameZh: "朗斯", code: "RCL", color: "#FFD100" },
  "Brest": { nameZh: "布雷斯特", code: "SB29", color: "#E2001A" },
  "Internazionale": { nameZh: "国际米兰", code: "INT", color: "#0068A8" },
  "Napoli": { nameZh: "那不勒斯", code: "NAP", color: "#12A0D7" },
  "AC Milan": { nameZh: "AC米兰", code: "MIL", color: "#FB090B" },
  "Juventus": { nameZh: "尤文图斯", code: "JUV", color: "#2A2A2A" },
  "Roma": { nameZh: "罗马", code: "ROM", color: "#8E1F2F" },
  "Lazio": { nameZh: "拉齐奥", code: "LAZ", color: "#87D8F7" },
  "Atalanta": { nameZh: "亚特兰大", code: "ATA", color: "#1D2951" },
  "Fiorentina": { nameZh: "佛罗伦萨", code: "FIO", color: "#592C82" },
  "Porto": { nameZh: "波尔图", code: "POR", color: "#003DA5" },
  "Benfica": { nameZh: "本菲卡", code: "SLB", color: "#DA291C" },
  "Sporting CP": { nameZh: "葡萄牙体育", code: "SCP", color: "#008057" },
  "PSV Eindhoven": { nameZh: "埃因霍温", code: "PSV", color: "#ED1C24" },
  "Feyenoord": { nameZh: "费耶诺德", code: "FEY", color: "#C8102E" },
  "Ajax": { nameZh: "阿贾克斯", code: "AJA", color: "#D2122E" },
  "Club Brugge": { nameZh: "布鲁日", code: "CLB", color: "#005CA9" },
  "Union Saint-Gilloise": { nameZh: "圣吉尔联", code: "USG", color: "#F7D117" },
  "Celtic": { nameZh: "凯尔特人", code: "CEL", color: "#00843D" },
  "Rangers": { nameZh: "格拉斯哥流浪者", code: "RAN", color: "#1B458F" },
  "Galatasaray": { nameZh: "加拉塔萨雷", code: "GAL", color: "#A90432" },
  "Fenerbahçe": { nameZh: "费内巴切", code: "FEN", color: "#FFED00" },
  "Olympiacos": { nameZh: "奥林匹亚科斯", code: "OLY", color: "#DA291C" },
  "Slavia Praha": { nameZh: "布拉格斯拉维亚", code: "SLA", color: "#C8102E" },
  "Sparta Praha": { nameZh: "布拉格斯拉维亚", code: "SPA", color: "#B01B2E" },
  "RB Salzburg": { nameZh: "萨尔茨堡红牛", code: "RBS", color: "#C8102E" },
  "Shakhtar Donetsk": { nameZh: "顿涅茨克矿工", code: "SHK", color: "#FF6600" },
  "Dinamo Zagreb": { nameZh: "萨格勒布迪纳摩", code: "DZG", color: "#0B2C6F" },
  "Red Star Belgrade": { nameZh: "贝尔格莱德红星", code: "CZV", color: "#C8102E" },
  "Young Boys": { nameZh: "年轻人", code: "YB", color: "#F5C400" },
  "Sturm Graz": { nameZh: "格拉茨风暴", code: "STU", color: "#1F7A45" },
  "Copenhagen": { nameZh: "哥本哈根", code: "FCK", color: "#1B3E8B" },
  "Qarabağ": { nameZh: "卡拉巴赫", code: "QAR", color: "#1F7A45" },
  "Pafos": { nameZh: "帕福斯", code: "PAF", color: "#1F7A45" },
  "Kairat Almaty": { nameZh: "卡拉特", code: "KAI", color: "#1F7A45" },
  "Sabah": { nameZh: "萨巴赫", code: "SAB", color: "#1F7A45" },
  "Bodø/Glimt": { nameZh: "博多闪耀", code: "BOD", color: "#C99700" },
  "Minsk": { nameZh: "明斯克", code: "MIN", color: "#1F7A45" },
  "Viktoria Plzeň": { nameZh: "比尔森胜利", code: "PLZ", color: "#C8102E" },
  "Union SG": { nameZh: "圣吉尔联", code: "USG", color: "#F7D117" },
  "Emirates Club": { nameZh: "酋长队", code: "EMI", color: "#6E6E7A" },
  "Sabadell": { nameZh: "萨瓦德尔", code: "SAB", color: "#6E6E7A" },
  "Inter Club d'Escaldes": { nameZh: "埃斯卡尔德斯", code: "ICE", color: "#6E6E7A" },
  "Villefranche": { nameZh: "维尔弗朗什", code: "VIL", color: "#6E6E7A" },
};

/** 未知队名时用名称首字母兜底生成 3 字母缩写 */
function derivedCode(raw: string): string {
  const words = raw.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  return raw.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 3).toUpperCase() || "—";
}

/** 把任意来源的队名解析成身份信息（永远返回可用值） */
export function clubIdentity(raw: string | null | undefined): ClubIdentity {
  const name = (raw ?? "").trim();
  if (!name) return { nameZh: "待定", code: "—", color: "#2A2A36" };
  const normalized = normalizeClubName(name);
  const key = ALIASES[name] ?? ALIASES[normalized] ?? normalized;
  const hit = CLUBS[key] ?? CLUBS[name];
  if (hit) return hit;
  return { nameZh: name, code: derivedCode(name), color: "#2A2A36" };
}

/** 中文队名（未知则原样返回英文名，而不是丢掉信息） */
export function clubName(raw: string | null | undefined): string {
  return clubIdentity(raw).nameZh;
}
