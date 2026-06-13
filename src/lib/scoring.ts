export type PlayerMatchStats = {
  minutes: number;
  rating?: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  saves: number;
  penaltySaved: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  penaltyMissed: number;
};

export type ScoringRules = {
  appearance: number;
  sixtyMinutes: number;
  goal: number;
  assist: number;
  cleanSheet: number;
  everyThreeSaves: number;
  penaltySaved: number;
  yellowCard: number;
  redCard: number;
  ownGoal: number;
  penaltyMissed: number;
  ratingMultiplier: number;
};

export const defaultScoringRules: ScoringRules = {
  appearance: 1, sixtyMinutes: 1, goal: 5, assist: 3, cleanSheet: 3,
  everyThreeSaves: 1, penaltySaved: 5, yellowCard: -1, redCard: -3,
  ownGoal: -2, penaltyMissed: -2, ratingMultiplier: 1,
};

export function calculateFantasyPoints(stats: PlayerMatchStats, rules: ScoringRules = defaultScoringRules) {
  if (stats.minutes <= 0) return 0;
  const ratingPoints = stats.rating ? Math.round((stats.rating - 6) * rules.ratingMultiplier) : 0;
  return rules.appearance
    + (stats.minutes >= 60 ? rules.sixtyMinutes : 0)
    + stats.goals * rules.goal
    + stats.assists * rules.assist
    + (stats.cleanSheet && stats.minutes >= 60 ? rules.cleanSheet : 0)
    + Math.floor(stats.saves / 3) * rules.everyThreeSaves
    + stats.penaltySaved * rules.penaltySaved
    + stats.yellowCards * rules.yellowCard
    + stats.redCards * rules.redCard
    + stats.ownGoals * rules.ownGoal
    + stats.penaltyMissed * rules.penaltyMissed
    + ratingPoints;
}
