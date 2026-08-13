import { SESSION_ABS_MS, SESSION_IDLE_MS, SESSION_ROTATE_MS, MAX_SESSIONS } from "../../../shared/src/index";
import type { Account, Store } from "../persist/store";
import { mintToken } from "../security/crypto";
import type { Audit } from "../security/audit";
import type { Watch } from "../security/watch";

export interface DeviceSession {
  id: string;
  accountId: string;
  token: string;
  issued: number;
  seen: number;
  device: string;
  ip: string;
  revoked: boolean;
}

export class Sessions {
  private live = new Map<string, DeviceSession>();

  constructor(
    private store: Store,
    private audit?: Audit,
    private watch?: Watch,
  ) {}

  issue(
    name: string,
    existingToken?: string,
    meta?: { device?: string; ip?: string },
  ): { token: string; account: Account; rotated: boolean } {
    if (existingToken) {
      const cur = this.resolve(existingToken);
      if (cur) {
        const rotated = this.maybeRotate(existingToken, meta);
        if (name) this.store.rename(cur.id, name);
        return { token: rotated.token, account: cur, rotated: rotated.changed };
      }
    }
    const account = this.store.createGuest(name);
    const sess = this.open(account.id, meta);
    this.store.setSessionToken(account.id, sess.token);
    this.audit?.write({ kind: "session", actor: account.id, detail: "guest issued" });
    return { token: sess.token, account, rotated: false };
  }

  resolve(token: string): Account | null {
    if (!token) return null;
    const sess = this.live.get(token);
    const now = Date.now();
    if (sess) {
      if (sess.revoked) return null;
      if (now - sess.issued > SESSION_ABS_MS || now - sess.seen > SESSION_IDLE_MS) {
        sess.revoked = true;
        return null;
      }
      const acc = this.store.byId(sess.accountId);
      if (!acc || acc.deletedAt) return null;
      sess.seen = now;
      return acc;
    }
    const acc = this.store.bySession(token);
    if (!acc || acc.deletedAt) return null;
    this.live.set(token, {
      id: "sx_" + token.slice(0, 8),
      accountId: acc.id,
      token,
      issued: now,
      seen: now,
      device: "restored",
      ip: "",
      revoked: false,
    });
    return acc;
  }

  open(accountId: string, meta?: { device?: string; ip?: string }): DeviceSession {
    const now = Date.now();
    const mine = [...this.live.values()].filter((s) => s.accountId === accountId && !s.revoked);
    if (mine.length >= MAX_SESSIONS) {
      mine.sort((a, b) => a.seen - b.seen);
      mine[0].revoked = true;
    }
    if (mine.length >= 1 && meta?.device && mine.some((s) => s.device && s.device !== (meta.device || ""))) {
      this.watch?.ingest({
        at: now,
        playerId: accountId,
        name: this.store.byId(accountId)?.name || accountId,
        kind: "packet",
        detail: "simultaneous sessions",
        severity: 1,
      });
    }
    const sess: DeviceSession = {
      id: "sx_" + mintToken(6),
      accountId,
      token: mintToken(24),
      issued: now,
      seen: now,
      device: (meta?.device || "web").slice(0, 80),
      ip: (meta?.ip || "").slice(0, 64),
      revoked: false,
    };
    this.live.set(sess.token, sess);
    return sess;
  }

  maybeRotate(token: string, meta?: { device?: string; ip?: string }): { token: string; changed: boolean } {
    const sess = this.live.get(token);
    if (!sess || sess.revoked) return { token, changed: false };
    if (Date.now() - sess.issued < SESSION_ROTATE_MS) {
      if (meta?.device) sess.device = meta.device.slice(0, 80);
      return { token, changed: false };
    }
    sess.revoked = true;
    const next = this.open(sess.accountId, meta);
    this.store.setSessionToken(sess.accountId, next.token);
    this.audit?.write({ kind: "session", actor: sess.accountId, detail: "rotated" });
    return { token: next.token, changed: true };
  }

  revoke(token: string): void {
    const sess = this.live.get(token);
    if (sess) sess.revoked = true;
  }

  revokeAll(accountId: string): void {
    for (const s of this.live.values()) if (s.accountId === accountId) s.revoked = true;
  }

  list(accountId: string): { id: string; device: string; issued: number; seen: number; current: boolean }[] {
    return [...this.live.values()]
      .filter((s) => s.accountId === accountId && !s.revoked)
      .map((s) => ({ id: s.id, device: s.device, issued: s.issued, seen: s.seen, current: true }));
  }

  bindLogin(account: Account, meta?: { device?: string; ip?: string }): string {
    this.revokeAll(account.id);
    const sess = this.open(account.id, meta);
    this.store.setSessionToken(account.id, sess.token);
    return sess.token;
  }

  guestName(): string {
    return "OP-" + mintToken(2).slice(0, 4).toUpperCase();
  }
}
