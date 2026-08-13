import type http from "node:http";
import {
  RECOVERY_TTL_MS,
  emailOk,
  passwordOk,
  securityPublic,
  type PenaltyKind,
} from "../../../shared/src/index";
import type { Store } from "../persist/store";
import type { Sessions } from "../net/session";
import { hashSecret, mintRecovery, verifySecret } from "./crypto";
import type { RateGate } from "./rate";
import { audit } from "./audit";
import type { Watch } from "./watch";
import { ModDesk, staffCan, staffRoleOf } from "./mod";
import { listBackups, snapshotBackup } from "./backup";

export interface SecDeps {
  store: Store;
  sessions: Sessions;
  rate: RateGate;
  watch: Watch;
  mod: ModDesk;
  staffKey: string;
  reports: () => unknown;
  ip: (req: http.IncomingMessage) => string;
  json: (res: http.ServerResponse, status: number, body: unknown) => void;
  readBody: (req: http.IncomingMessage) => Promise<Record<string, unknown>>;
}

export function handleSecurity(url: URL, req: http.IncomingMessage, res: http.ServerResponse, d: SecDeps): boolean {
  if (url.pathname === "/api/security") {
    d.json(res, 200, securityPublic());
    return true;
  }

  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    void d.readBody(req).then((body) => {
      if (!d.rate.allow("register", d.ip(req))) return d.json(res, 429, { error: "rate" });
      const email = emailOk(String(body.email || ""));
      const pass = String(body.password || "");
      if (!email || !passwordOk(pass)) return d.json(res, 400, { error: "bad_credentials" });
      const token = String(body.token || "");
      const acc = (token && d.sessions.resolve(token)) || d.store.createGuest("");
      const hashed = hashSecret(pass);
      const err = d.store.claimEmail(acc.id, email, hashed.salt, hashed.hash);
      if (err) return d.json(res, 409, { error: err });
      const next = d.sessions.bindLogin(acc, { device: String(body.device || "web"), ip: d.ip(req) });
      audit.write({ kind: "register", actor: acc.id, detail: "claimed" });
      d.json(res, 200, { token: next, profile: d.store.profileOf(d.store.byId(acc.id)!) });
    });
    return true;
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    void d.readBody(req).then((body) => {
      if (!d.rate.allow("login", d.ip(req))) return d.json(res, 429, { error: "rate" });
      const email = emailOk(String(body.email || ""));
      const pass = String(body.password || "");
      const acc = email ? d.store.byEmail(email) : undefined;
      if (!acc || !acc.passHash || !acc.passSalt || !passwordOk(pass) || !verifySecret(pass, acc.passSalt, acc.passHash)) {
        d.watch.ingest({
          at: Date.now(),
          playerId: acc?.id || "anon",
          name: acc?.name || "anon",
          kind: "login",
          detail: "failed login",
          severity: 1,
        });
        return d.json(res, 401, { error: "bad_credentials" });
      }
      if (d.store.isBanned(acc)) return d.json(res, 403, { error: "banned", message: acc.banReason || "restricted" });
      const token = d.sessions.bindLogin(acc, { device: String(body.device || "web"), ip: d.ip(req) });
      audit.write({ kind: "login", actor: acc.id, detail: "ok" });
      d.json(res, 200, { token, profile: d.store.profileOf(acc) });
    });
    return true;
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    void d.readBody(req).then((body) => {
      const token = String(body.token || "");
      const acc = d.sessions.resolve(token);
      d.sessions.revoke(token);
      if (acc) audit.write({ kind: "logout", actor: acc.id, detail: "one" });
      d.json(res, 200, { ok: true });
    });
    return true;
  }

  if (url.pathname === "/api/auth/logout-all" && req.method === "POST") {
    void d.readBody(req).then((body) => {
      const acc = d.sessions.resolve(String(body.token || ""));
      if (!acc) return d.json(res, 401, { error: "bad_session" });
      d.sessions.revokeAll(acc.id);
      audit.write({ kind: "logout", actor: acc.id, detail: "all" });
      d.json(res, 200, { ok: true });
    });
    return true;
  }

  if (url.pathname === "/api/auth/recover" && req.method === "POST") {
    void d.readBody(req).then((body) => {
      if (!d.rate.allow("recover", d.ip(req))) return d.json(res, 429, { error: "rate" });
      const email = emailOk(String(body.email || ""));
      const acc = email ? d.store.byEmail(email) : undefined;
      if (!acc) return d.json(res, 200, { ok: true });
      const code = mintRecovery();
      const hashed = hashSecret(code);
      d.store.setRecovery(acc.id, hashed.salt, hashed.hash, Date.now() + RECOVERY_TTL_MS);
      d.json(res, 200, { ok: true, code });
    });
    return true;
  }

  if (url.pathname === "/api/auth/recover/confirm" && req.method === "POST") {
    void d.readBody(req).then((body) => {
      const email = emailOk(String(body.email || ""));
      const code = String(body.code || "");
      const pass = String(body.password || "");
      const acc = email ? d.store.byEmail(email) : undefined;
      if (!acc || !acc.recoveryHash || !acc.recoverySalt || !acc.recoveryUntil || acc.recoveryUntil < Date.now()) {
        return d.json(res, 400, { error: "bad_recovery" });
      }
      if (!verifySecret(code, acc.recoverySalt, acc.recoveryHash) || !passwordOk(pass)) {
        return d.json(res, 400, { error: "bad_recovery" });
      }
      const hashed = hashSecret(pass);
      d.store.setPass(acc.id, hashed.salt, hashed.hash);
      const token = d.sessions.bindLogin(acc, { device: "recover", ip: d.ip(req) });
      d.json(res, 200, { token, profile: d.store.profileOf(acc) });
    });
    return true;
  }

  if (url.pathname === "/api/auth/sessions" && req.method === "GET") {
    const acc = d.sessions.resolve(url.searchParams.get("token") || "");
    if (!acc) {
      d.json(res, 401, { error: "bad_session" });
      return true;
    }
    d.json(res, 200, { sessions: d.sessions.list(acc.id) });
    return true;
  }

  if (url.pathname === "/api/me/export" && req.method === "GET") {
    const acc = d.sessions.resolve(url.searchParams.get("token") || "");
    if (!acc) {
      d.json(res, 401, { error: "bad_session" });
      return true;
    }
    audit.write({ kind: "export", actor: acc.id, detail: "self" });
    d.json(res, 200, d.store.exportSafe(acc.id));
    return true;
  }

  if (url.pathname === "/api/me/delete" && req.method === "POST") {
    void d.readBody(req).then((body) => {
      const acc = d.sessions.resolve(String(body.token || ""));
      if (!acc) return d.json(res, 401, { error: "bad_session" });
      if (String(body.confirm || "") !== acc.id) return d.json(res, 400, { error: "confirm" });
      d.sessions.revokeAll(acc.id);
      d.store.deleteAccount(acc.id);
      audit.write({ kind: "delete", actor: acc.id, detail: "self" });
      d.json(res, 200, { ok: true });
    });
    return true;
  }

  if (url.pathname === "/api/me/correct" && req.method === "POST") {
    void d.readBody(req).then((body) => {
      const acc = d.sessions.resolve(String(body.token || ""));
      if (!acc) return d.json(res, 401, { error: "bad_session" });
      if (body.name) d.store.rename(acc.id, String(body.name));
      d.json(res, 200, { profile: d.store.profileOf(d.store.byId(acc.id)!) });
    });
    return true;
  }

  if (!url.pathname.startsWith("/api/staff")) return false;

  const role = staffRoleOf(String(req.headers["x-helix-staff"] || ""), d.staffKey);
  if (!role) {
    d.json(res, 401, { error: "staff" });
    return true;
  }
  if (!d.rate.allow("staff", d.ip(req))) {
    d.json(res, 429, { error: "rate" });
    return true;
  }

  if (url.pathname === "/api/staff/reports") {
    d.json(res, 200, { role, reports: d.reports() });
    return true;
  }
  if (url.pathname === "/api/staff/alerts") {
    d.json(res, 200, { role, alerts: d.watch.list(40) });
    return true;
  }
  if (url.pathname === "/api/staff/audit") {
    d.json(res, 200, { role, rows: audit.list(80, url.searchParams.get("kind") || undefined, url.searchParams.get("player") || undefined) });
    return true;
  }
  if (url.pathname.startsWith("/api/staff/player/")) {
    const id = url.pathname.slice("/api/staff/player/".length);
    d.json(res, 200, { role, player: d.mod.playerCard(id) });
    return true;
  }
  if (url.pathname.startsWith("/api/staff/match/")) {
    const id = url.pathname.slice("/api/staff/match/".length);
    d.json(res, 200, { role, match: d.store.lastMatch(id) || null });
    return true;
  }
  if (url.pathname === "/api/staff/sanctions") {
    d.json(res, 200, { role, rows: d.mod.list(40) });
    return true;
  }
  if (url.pathname === "/api/staff/sanction" && req.method === "POST") {
    if (!staffCan(role, "write")) {
      d.json(res, 403, { error: "role" });
      return true;
    }
    void d.readBody(req).then((body) => {
      const out = d.mod.issue(
        "staff:" + role,
        String(body.target || ""),
        (String(body.kind || "warning") as PenaltyKind) || "warning",
        String(body.reason || ""),
        Number(body.hours) || 24,
      );
      d.json(res, typeof out === "string" ? 400 : 200, typeof out === "string" ? { error: out } : out);
    });
    return true;
  }
  if (url.pathname === "/api/staff/reverse" && req.method === "POST") {
    if (!staffCan(role, "write")) {
      d.json(res, 403, { error: "role" });
      return true;
    }
    void d.readBody(req).then((body) => {
      const err = d.mod.reverse("staff:" + role, String(body.target || ""));
      d.json(res, err ? 400 : 200, err ? { error: err } : { ok: true });
    });
    return true;
  }
  if (url.pathname === "/api/staff/backup" && req.method === "POST") {
    if (!staffCan(role, "admin")) {
      d.json(res, 403, { error: "role" });
      return true;
    }
    const snap = snapshotBackup();
    audit.write({ kind: "backup", actor: "staff:" + role, detail: snap?.file || "none" });
    d.json(res, 200, { ok: true, snap, list: listBackups() });
    return true;
  }

  d.json(res, 404, { error: "not_found" });
  return true;
}
