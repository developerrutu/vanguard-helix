import { detectLang, netQuality, setLang, t, uxPublic } from "../shared/src/i18n.ts";
import { ENGINE_VERSION, PROTOCOL_VERSION } from "../shared/src/constants.ts";

if (PROTOCOL_VERSION < 10) throw new Error("version");
if (detectLang("hi-IN") !== "hi") throw new Error("detect hi");
if (detectLang("en-US") !== "en") throw new Error("detect en");
setLang("en");
if (t("nav_start") !== "START GAME") throw new Error("en start");
setLang("hi");
if (!t("nav_start").includes("खेल")) throw new Error("hi start " + t("nav_start"));
if (netQuality(20) !== "excellent") throw new Error("net");
if (netQuality(200) !== "poor") throw new Error("poor");
const pub = uxPublic();
if (!pub.identity.includes("ORBIT TRACE")) throw new Error("identity");
if (pub.langs.length < 2) throw new Error("langs");
console.log("ux ok", { proto: PROTOCOL_VERSION, engine: ENGINE_VERSION, identity: pub.identity.slice(0, 28) });
