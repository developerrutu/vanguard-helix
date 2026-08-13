export interface MatchRules {
  scoreToWin: number | null;
  timeLimitSec: number | null;
  friendlyFire: boolean;
  persistAtEnd: boolean;
  battleRoyale: boolean;
  respawn: boolean;
}

export const RANGE_RULES: MatchRules = {
  scoreToWin: null,
  timeLimitSec: null,
  friendlyFire: true,
  persistAtEnd: false,
  battleRoyale: false,
  respawn: true,
};

export const RANKED_RULES: MatchRules = {
  scoreToWin: null,
  timeLimitSec: 18 * 60,
  friendlyFire: false,
  persistAtEnd: true,
  battleRoyale: true,
  respawn: false,
};
