// ---------------------------------------------------------------
// 阿森纳 2026-27 赛季球员财务数据
// 来源：arsenal_2026_27_finances.xlsx（身价 / 周薪 / 年薪 / 合同到期）
// 以球员 id（squad slug）为键，供球员资料页查询。
// ---------------------------------------------------------------

export interface PlayerFinance {
  /** 身价（百万欧元 €m） */
  marketValue: number;
  /** 周薪（英镑 £） */
  weeklyWage: number;
  /** 年薪（百万英镑 £m） */
  annualSalary: number;
  /** 合同到期年份 */
  contractUntil: number;
  /** 备注（估值来源 / 口径差异等） */
  note?: string;
}

export const PLAYER_FINANCE: Record<string, PlayerFinance> = {
  "david-raya": { marketValue: 30, weeklyWage: 100000, annualSalary: 5.2, contractUntil: 2028 },
  "william-saliba": { marketValue: 100, weeklyWage: 250000, annualSalary: 13, contractUntil: 2030 },
  "gabriel-magalhaes": { marketValue: 75, weeklyWage: 150000, annualSalary: 7.8, contractUntil: 2029 },
  "piero-hincapie": { marketValue: 50, weeklyWage: 100000, annualSalary: 5.2, contractUntil: 2031, note: "周薪FFC估值；TM合同2031(FFC记2029)" },
  "ben-white": { marketValue: 30, weeklyWage: 150000, annualSalary: 7.8, contractUntil: 2028 },
  "jurrien-timber": { marketValue: 70, weeklyWage: 90000, annualSalary: 4.7, contractUntil: 2028 },
  "riccardo-calafiori": { marketValue: 55, weeklyWage: 120000, annualSalary: 6.2, contractUntil: 2029 },
  "myles-lewis-skelly": { marketValue: 45, weeklyWage: 45000, annualSalary: 2.3, contractUntil: 2030, note: "周薪FFC 45k(国家报40k)" },
  "ezri-konsa": { marketValue: 45, weeklyWage: 150000, annualSalary: 7.8, contractUntil: 2030 },
  "cristhian-mosquera": { marketValue: 40, weeklyWage: 55000, annualSalary: 2.9, contractUntil: 2030 },
  "declan-rice": { marketValue: 120, weeklyWage: 240000, annualSalary: 12.5, contractUntil: 2028 },
  "bruno-guimaraes": { marketValue: 70, weeklyWage: 250000, annualSalary: 13, contractUntil: 2030 },
  "martin-odegaard": { marketValue: 70, weeklyWage: 240000, annualSalary: 12.5, contractUntil: 2028 },
  "eberechi-eze": { marketValue: 65, weeklyWage: 180000, annualSalary: 9.4, contractUntil: 2029 },
  "mikel-merino": { marketValue: 25, weeklyWage: 130000, annualSalary: 6.8, contractUntil: 2028 },
  "martin-zubimendi": { marketValue: 75, weeklyWage: 75000, annualSalary: 3.9, contractUntil: 2030 },
  "max-dowman": { marketValue: 30, weeklyWage: 35000, annualSalary: 1.8, contractUntil: 2030 },
  "bukayo-saka": { marketValue: 110, weeklyWage: 300000, annualSalary: 15.6, contractUntil: 2030 },
  "viktor-gyokeres": { marketValue: 65, weeklyWage: 200000, annualSalary: 10.4, contractUntil: 2030 },
  "kai-havertz": { marketValue: 55, weeklyWage: 280000, annualSalary: 14.6, contractUntil: 2028 },
  "noni-madueke": { marketValue: 50, weeklyWage: 150000, annualSalary: 7.8, contractUntil: 2030 },
  "christos-tzolis": { marketValue: 40, weeklyWage: 90000, annualSalary: 4.7, contractUntil: 2031 },
  "kepa-arrizabalaga": { marketValue: 5, weeklyWage: 60000, annualSalary: 3.1, contractUntil: 2028 },
  "illan-meslier": { marketValue: 8, weeklyWage: 30000, annualSalary: 1.6, contractUntil: 2028 },
};
