import { describe, it, expect } from "vitest";
import { entryToFixtureView } from "@/lib/queries/fixture-entry-view";
import type { FixtureEntryView } from "@/lib/queries/fixtureEntries";

function makeEntry(overrides: Partial<FixtureEntryView>): FixtureEntryView {
  return {
    id: "row-1",
    season: 2026,
    kickoffAt: new Date("2026-09-15T14:00:00.000Z"),
    competition: "Premier League",
    competitionCode: "PL",
    opponentName: "Manchester City",
    opponentKey: "manchestercity",
    opponentCrest: "https://crests.football-data.org/65.png",
    homeAway: "HOME",
    status: "SCHEDULED",
    homeScore: null,
    awayScore: null,
    matchDate: new Date("2026-09-15T00:00:00.000Z"),
    sources: ["football-data.org"],
    verified: true,
    primarySource: "football-data.org",
    ...overrides,
  } as FixtureEntryView;
}

describe("entryToFixtureView（首页数据源统一 P1-⑥）", () => {
  it("主场：homeTeam 是 Arsenal(57)，awayTeam 是对手", () => {
    const v = entryToFixtureView(makeEntry({ homeAway: "HOME" }));
    expect(v.homeTeam.id).toBe("57");
    expect(v.homeTeam.name).toBe("Arsenal");
    expect(v.awayTeam.name).toBe("Manchester City");
    expect(v.awayTeam.crest).toBe("https://crests.football-data.org/65.png");
  });

  it("客场：homeTeam 是对手，awayTeam 是 Arsenal", () => {
    const v = entryToFixtureView(makeEntry({ homeAway: "AWAY" }));
    expect(v.homeTeam.name).toBe("Manchester City");
    expect(v.awayTeam.id).toBe("57");
  });

  it("比分与赛事正确映射", () => {
    const v = entryToFixtureView(makeEntry({ status: "FINISHED", homeScore: 2, awayScore: 1 }));
    expect(v.score).toEqual({ home: 2, away: 1, halfTimeHome: null, halfTimeAway: null });
    expect(v.competition).toEqual({ name: "Premier League", code: "PL" });
    expect(v.status).toBe("FINISHED");
  });

  it("opponent providerTeamId 用 opponentName（FixtureEntryView 无 opponentKey 字段）", () => {
    const v = entryToFixtureView(makeEntry({}));
    expect(v.awayTeam.providerTeamId).toBe("Manchester City");
  });
});
