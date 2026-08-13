import {
  PENALTIES,
  RATE_LIMITS,
  REPORT_REASONS,
  autoPunishForbidden,
  emailOk,
  passwordOk,
  playerIdOk,
  recommendAction,
  sanitizeInput,
  securityPublic,
} from "../shared/src/security.ts";
import { ENGINE_VERSION, PROTOCOL_VERSION } from "../shared/src/constants.ts";
import { hashSecret, verifySecret } from "../server/src/security/crypto.ts";

if (PROTOCOL_VERSION < 12) throw new Error("version");
if (REPORT_REASONS.length < 8) throw new Error("reasons");
if (!PENALTIES.includes("ban")) throw new Error("penalty");
if (RATE_LIMITS.login.max < 3) throw new Error("login rate");
if (emailOk("not-mail")) throw new Error("email bad");
if (emailOk("op@helix.dev") !== "op@helix.dev") throw new Error("email ok");
if (passwordOk("short")) throw new Error("pw short");
if (!passwordOk("longenough")) throw new Error("pw ok");
if (!playerIdOk("p_ab12cd34ef56")) throw new Error("id");
if (playerIdOk("admin")) throw new Error("guessable");
const bad = sanitizeInput({ seq: "nope" });
if (bad) throw new Error("sanitize");
const ok = sanitizeInput({ seq: 4, dt: 0.03, moveX: 2, moveY: -2, lookX: 0, lookY: 0, buttons: 3 });
if (!ok || ok.moveX !== 1 || ok.moveY !== -1) throw new Error("clamp");
if (recommendAction(2, 1) !== "observe") throw new Error("observe");
if (recommendAction(22, 4) !== "restrict") throw new Error("restrict");
if (!autoPunishForbidden("restrict")) throw new Error("no auto");
const h = hashSecret("correct horse");
if (!verifySecret("correct horse", h.salt, h.hash)) throw new Error("verify");
if (verifySecret("wrong", h.salt, h.hash)) throw new Error("reject");
const pub = securityPublic();
if (!pub.rule.toLowerCase().includes("untrusted")) throw new Error("rule");
if (!pub.privacy.includes("delete")) throw new Error("privacy");
console.log("security ok", { proto: PROTOCOL_VERSION, engine: ENGINE_VERSION, action: recommendAction(14, 3) });
