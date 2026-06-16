export type Position = "POR" | "DEF" | "MED" | "DEL";

export type MarketSettings = {
  bids: boolean;
  fixedPrice: boolean;
  clauses: boolean;
  directTransfers: boolean;
  visibleBids: boolean;
};

// Normas configurables de puntuación y economía de la liga.
export type LeagueRules = {
  unalignedPenalty: number;       // puntos por cada hueco de titular sin alinear (negativo)
  negativeBalancePenalty: number; // puntos si terminas la jornada con saldo negativo (negativo)
  moneyPerPoint: number;          // € que ganas por cada punto positivo de la jornada
};

export type LeagueSettings = {
  captain: boolean;
  captainMultiplier: number;
  bench: boolean;
  benchSlots: number;
  marketSize: number;
  clauseMultiplier: number;
  market: MarketSettings;
  rules: LeagueRules;
};

export const defaultLeagueRules: LeagueRules = {
  unalignedPenalty: -4,
  negativeBalancePenalty: 0,
  moneyPerPoint: 0,
};

export const defaultLeagueSettings: LeagueSettings = {
  captain: true,
  captainMultiplier: 1.5,
  bench: true,
  benchSlots: 4,
  marketSize: 8,
  clauseMultiplier: 1.4,
  market: { bids: true, fixedPrice: true, clauses: true, directTransfers: true, visibleBids: true },
  rules: defaultLeagueRules,
};

export function parseLeagueSettings(raw: unknown): LeagueSettings {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const market = (data.market && typeof data.market === "object" ? data.market : {}) as Record<string, unknown>;
  const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
  const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
  return {
    captain: bool(data.captain, defaultLeagueSettings.captain),
    captainMultiplier: num(data.captainMultiplier, defaultLeagueSettings.captainMultiplier),
    bench: bool(data.bench, defaultLeagueSettings.bench),
    benchSlots: Math.min(7, Math.max(1, num(data.benchSlots, defaultLeagueSettings.benchSlots))),
    marketSize: Math.min(16, Math.max(4, num(data.marketSize, defaultLeagueSettings.marketSize))),
    clauseMultiplier: Math.min(3, Math.max(1.1, num(data.clauseMultiplier, defaultLeagueSettings.clauseMultiplier))),
    market: {
      bids: bool(market.bids ?? (market as Record<string, unknown>).fantasy_bids, true),
      fixedPrice: bool(market.fixedPrice, true),
      clauses: bool(market.clauses, true),
      directTransfers: bool(market.directTransfers, true),
      visibleBids: bool(market.visibleBids, true),
    },
    rules: parseLeagueRules((data as Record<string, unknown>).rules),
  };
}

function parseLeagueRules(raw: unknown): LeagueRules {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  return {
    unalignedPenalty: num(data.unalignedPenalty, defaultLeagueRules.unalignedPenalty, -50, 0),
    negativeBalancePenalty: num(data.negativeBalancePenalty, defaultLeagueRules.negativeBalancePenalty, -100, 0),
    moneyPerPoint: num(data.moneyPerPoint, defaultLeagueRules.moneyPerPoint, 0, 5_000_000),
  };
}

export const formations: Record<string, { DEF: number; MED: number; DEL: number }> = {
  "4-4-2": { DEF: 4, MED: 4, DEL: 2 },
  "4-3-3": { DEF: 4, MED: 3, DEL: 3 },
  "3-5-2": { DEF: 3, MED: 5, DEL: 2 },
  "5-3-2": { DEF: 5, MED: 3, DEL: 2 },
  "3-4-3": { DEF: 3, MED: 4, DEL: 3 },
  "4-5-1": { DEF: 4, MED: 5, DEL: 1 },
  "5-4-1": { DEF: 5, MED: 4, DEL: 1 },
};

export type ApiPlayer = {
  id: string;
  name: string;
  position: Position;
  team: string;
  teamShort: string;
  teamColor: string;
  teamLogo: string | null;
  photo: string | null;
  value: number;
  seasonPoints: number;
  lastPoints: number | null;
  last5?: number[];
};

export type SquadEntry = ApiPlayer & {
  purchasePrice: number;
  clauseValue: number | null;
};

export type MemberSummary = {
  id: string;
  userId: string;
  displayName: string;
  teamName: string;
  role: "owner" | "admin" | "member";
  color: string;
  totalPoints: number;
  squadValue: number;
  squadSize: number;
  lastRoundPoints: number | null;
};

export type MarketListing = {
  id: string;
  kind: "bid" | "fixed" | "clause" | "direct";
  player: ApiPlayer;
  askingPrice: number;
  closesAt: string | null;
  sellerMemberId: string | null;
  sellerName: string | null;
  myBid: number | null;
  bidCount: number;
};

export type DirectOffer = {
  id: string;
  player: ApiPlayer;
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  amount: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
};

export type RivalSquadEntry = ApiPlayer & { clauseValue: number | null; memberId: string };

export type RivalLineup = {
  memberId: string;
  formation: string;
  captainPlayerId: string | null;
  starters: string[];
  submitted: boolean;
};

export type ActivityItem = {
  id: number;
  action: string;
  detail: string;
  actorName: string | null;
  createdAt: string;
};

export type LineupState = {
  formation: string;
  captainPlayerId: string | null;
  starters: string[];
  bench: string[];
};

export type RoundResult = {
  number: number;
  memberPoints: { memberId: string; points: number }[];
};

export type LeagueState = {
  user: { id: string; username: string; displayName: string };
  league: {
    id: string;
    name: string;
    inviteCode: string;
    season: number;
    currentMatchday: number;
    totalMatchdays: number;
    startingBudget: number;
    settings: LeagueSettings;
    isAdmin: boolean;
  };
  myMember: { id: string; budget: number; teamName: string; role: string };
  members: MemberSummary[];
  squad: SquadEntry[];
  lineup: LineupState;
  market: MarketListing[];
  rivalSquads: RivalSquadEntry[];
  rivalLineups: RivalLineup[];
  offersIn: DirectOffer[];
  offersOut: DirectOffer[];
  myListings: MarketListing[];
  lastMatchday: {
    number: number;
    memberPoints: { memberId: string; points: number }[];
    myPlayerPoints: Array<Pick<ApiPlayer, "name" | "team" | "teamShort" | "teamColor" | "teamLogo"> & {
      playerId: string;
      points: number;
      starter: boolean;
    }>;
  } | null;
  roundResults: RoundResult[];
  activity: ActivityItem[];
  notifications: NotificationItem[];
  unreadCount: number;
};

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
};

export type Membership = {
  leagueId: string;
  leagueName: string;
  teamName: string;
  role: string;
};
