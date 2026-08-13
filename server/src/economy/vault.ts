import {
  DAILY_ION,
  DAILY_XP,
  ionDailyMul,
  PASS_TIERS,
  PASS_XP_PER_TIER,
  SEASON_ID,
  TOPUP_ORBIT,
  dayKey,
  featuredIds,
  isCombatSku,
  passTierOf,
  passTiers,
  quoteOf,
  vaultById,
  type Quote,
  type WalletPublic,
} from "../../../shared/src/index";
import type { Account, Store } from "../persist/store";
import { audit } from "../security/audit";

const tiers = passTiers();

export class Vault {
  constructor(private store: Store) {}

  pack(acc: Account): { wallet: WalletPublic; featured: string[]; quote?: Quote } {
    this.settlePass(acc);
    acc = this.store.byId(acc.id) || acc;
    const w = this.store.walletOf(acc.id);
    const day = dayKey(Date.now());
    return {
      wallet: {
        ion: acc.currency.soft,
        orbit: acc.currency.hard,
        owned: w?.owned ?? ["duty", "em_hail", "bn_plain"],
        pass: {
          season: SEASON_ID,
          premium: acc.passPremium,
          tier: passTierOf(acc.passXp || 0),
          xp: acc.passXp || 0,
        },
        daily: { ready: acc.lastDaily !== day, next: day, ionMul: ionDailyMul() },
        trade: "disabled",
        gift: "disabled",
      },
      featured: featuredIds(),
    };
  }

  quote(sku: string): Quote | null {
    if (isCombatSku(sku)) return null;
    return quoteOf(sku);
  }

  buy(acc: Account, sku: string, requestId: string): { ok: boolean; error?: string; wallet?: WalletPublic } {
    if (isCombatSku(sku)) return { ok: false, error: "not_in_vault" };
    if (TOPUP_ORBIT[sku]) return this.topup(acc, sku, requestId);
    const item = vaultById(sku);
    const q = quoteOf(sku);
    if (!item || !q) return { ok: false, error: "missing" };
    if (item.kind === "pass") {
      if (acc.passPremium) return { ok: false, error: "owned" };
      const cur = this.store.transact(acc.id, 0, -q.total, "pass:" + sku, requestId);
      if (!cur) return { ok: false, error: "funds" };
      this.store.setPassPremium(acc.id);
      const at = passTierOf(acc.passXp || 0);
      for (let t = 1; t <= at; t++) this.applyReward(acc, tiers[t - 1].premium);
      audit.write({ kind: "purchase", actor: acc.id, detail: sku });
      return { ok: true, wallet: this.pack(this.store.byId(acc.id)!).wallet };
    }
    if (this.store.owns(acc.id, sku) && item.kind !== "bundle") return { ok: false, error: "owned" };
    const ion = q.coin === "ion" ? -q.total : 0;
    const orbit = q.coin === "orbit" ? -q.total : 0;
    const cur = this.store.transact(acc.id, ion, orbit, "buy:" + sku, requestId);
    if (!cur) return { ok: false, error: "funds" };
    for (const g of item.grants) this.store.grantOwned(acc.id, g);
    this.store.grantOwned(acc.id, sku);
    audit.write({ kind: "purchase", actor: acc.id, detail: sku });
    return { ok: true, wallet: this.pack(this.store.byId(acc.id)!).wallet };
  }

  topup(acc: Account, sku: string, requestId: string): { ok: boolean; error?: string; wallet?: WalletPublic } {
    const amt = TOPUP_ORBIT[sku];
    if (!amt) return { ok: false, error: "missing" };
    const cur = this.store.transact(acc.id, 0, amt, "topup:" + sku, requestId);
    if (!cur) return { ok: false, error: "dup" };
    audit.write({ kind: "purchase", actor: acc.id, detail: "sandbox " + sku });
    return { ok: true, wallet: this.pack(this.store.byId(acc.id)!).wallet };
  }

  daily(acc: Account): { ok: boolean; error?: string; wallet?: WalletPublic } {
    const day = dayKey(Date.now());
    if (!this.store.claimDaily(acc.id, day)) return { ok: false, error: "claimed" };
    const ion = DAILY_ION * ionDailyMul();
    this.store.transact(acc.id, ion, 0, "daily:" + day, "daily-" + acc.id + "-" + day);
    this.store.grantXp(acc.id, DAILY_XP);
    audit.write({ kind: "reward", actor: acc.id, detail: "daily" });
    return { ok: true, wallet: this.pack(this.store.byId(acc.id)!).wallet };
  }

  settlePass(acc: Account): void {
    if (!acc.passPremium && passTierOf(acc.passXp || 0) === 0) return;
    const after = passTierOf(acc.passXp || 0);
    this.payoutPass(acc.id, 0, after, acc.passPremium);
  }

  private payoutPass(id: string, from: number, to: number, premium: boolean): void {
    const acc = this.store.byId(id);
    if (!acc) return;
    const start = Math.max(from, passTierOf(0));
    for (let t = start + 1; t <= to && t <= PASS_TIERS; t++) {
      const row = tiers[t - 1];
      this.applyReward(acc, row.free);
      if (premium) this.applyReward(acc, row.premium);
    }
  }

  private applyReward(acc: Account, r: { kind: string; id: string; qty: number }): void {
    if (r.kind === "ion") this.store.transact(acc.id, r.qty, 0, "pass:" + r.id);
    else if (r.kind === "orbit") this.store.transact(acc.id, 0, r.qty, "pass:" + r.id);
    else if (r.kind === "xp") this.store.grantXp(acc.id, r.qty);
    else if (r.kind === "item") this.store.grantOwned(acc.id, r.id);
  }
}
