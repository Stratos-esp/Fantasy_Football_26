import { describe, expect, it } from "vitest";
import { calculateFantasyPoints, defaultScoringRules, type PlayerMatchStats } from "./scoring";

const base: PlayerMatchStats = {
  minutes: 90, goals: 0, assists: 0, cleanSheet: false, saves: 0,
  penaltySaved: 0, yellowCards: 0, redCards: 0, ownGoals: 0, penaltyMissed: 0,
};

describe("calculateFantasyPoints", () => {
  it("no puntúa si no juega", () => {
    expect(calculateFantasyPoints({ ...base, minutes: 0, goals: 2 })).toBe(0);
  });

  it("suma aparición + 60 min de base", () => {
    expect(calculateFantasyPoints({ ...base })).toBe(defaultScoringRules.appearance + defaultScoringRules.sixtyMinutes);
  });

  it("suma goles y asistencias", () => {
    const pts = calculateFantasyPoints({ ...base, goals: 2, assists: 1 });
    const expected = defaultScoringRules.appearance + defaultScoringRules.sixtyMinutes
      + 2 * defaultScoringRules.goal + defaultScoringRules.assist;
    expect(pts).toBe(expected);
  });

  it("la portería a cero solo cuenta con 60+ minutos", () => {
    const withCs = calculateFantasyPoints({ ...base, cleanSheet: true });
    const shortCs = calculateFantasyPoints({ ...base, minutes: 45, cleanSheet: true });
    expect(withCs - shortCs).toBe(defaultScoringRules.cleanSheet + defaultScoringRules.sixtyMinutes);
  });

  it("resta tarjetas", () => {
    const pts = calculateFantasyPoints({ ...base, yellowCards: 1, redCards: 1 });
    expect(pts).toBe(defaultScoringRules.appearance + defaultScoringRules.sixtyMinutes
      + defaultScoringRules.yellowCard + defaultScoringRules.redCard);
  });
});
