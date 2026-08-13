import type { TeamId } from "../../../shared/src/index";
import type { Account } from "../persist/store";

export interface Seat {
  account: Account;
  bot: boolean;
  friend: boolean;
  ping: number;
  partyId: string;
}

export interface Assigned extends Seat {
  team: TeamId;
}

/**
 * Keep parties intact. Snake-draft remaining by MMR so team strength stays close.
 */
export function balanceTeams(seats: Seat[]): Assigned[] {
  const groups = new Map<string, Seat[]>();
  for (const s of seats) {
    const g = groups.get(s.partyId) || [];
    g.push(s);
    groups.set(s.partyId, g);
  }
  const units = [...groups.values()].sort((a, b) => strength(b) - strength(a));
  const alpha: Seat[] = [];
  const bravo: Seat[] = [];
  let aStr = 0;
  let bStr = 0;
  for (const u of units) {
    const s = strength(u);
    const canA = alpha.length + u.length <= 4;
    const canB = bravo.length + u.length <= 4;
    const preferA = aStr <= bStr;
    if (canA && (!canB || preferA)) {
      alpha.push(...u);
      aStr += s;
    } else if (canB) {
      bravo.push(...u);
      bStr += s;
    } else {
      for (const seat of u) {
        if (alpha.length < 4 && (alpha.length <= bravo.length || bravo.length >= 4)) alpha.push(seat);
        else bravo.push(seat);
      }
    }
  }
  return [
    ...alpha.map((s) => ({ ...s, team: "alpha" as const })),
    ...bravo.map((s) => ({ ...s, team: "bravo" as const })),
  ];
}

function strength(unit: Seat[]): number {
  return unit.reduce((n, s) => {
    const st = s.account.stats;
    const kd = st.deaths ? st.kills / st.deaths : st.kills;
    const acc = st.shots ? st.hits / st.shots : 0.2;
    const wr = st.matches ? st.wins / st.matches : 0.5;
    return n + s.account.mmr + kd * 20 + acc * 40 + wr * 50;
  }, 0);
}
