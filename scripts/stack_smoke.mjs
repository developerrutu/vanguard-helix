import {
  BROWSERS,
  ENGINE_VERSION,
  LAYERS,
  MIN_PROTOCOL,
  PROTOCOL_VERSION,
  TICK_HZ,
  matchTag,
  parseBrowser,
  protocolOk,
  stackPublic,
} from "../shared/src/index.ts";

if (PROTOCOL_VERSION !== 15 || ENGINE_VERSION !== "15.0.0") throw new Error("version");
if (MIN_PROTOCOL !== 15) throw new Error("min");
if (TICK_HZ !== 30) throw new Error("tick");
if (LAYERS.length < 10) throw new Error("layers");
if (BROWSERS.length < 4) throw new Error("browsers");
if (!parseBrowser("Mozilla/5.0 Chrome/120.0.0.0").ok) throw new Error("chrome");
if (parseBrowser("Mozilla/5.0 Chrome/90.0.0.0").ok) throw new Error("old chrome");
if (!protocolOk(15) || protocolOk(14)) throw new Error("proto gate");
if (!matchTag("rm_quick_12").startsWith("MATCH-")) throw new Error("tag");
const pub = stackPublic();
if (!pub.transport.toLowerCase().includes("websocket")) throw new Error("ws");
if (!pub.whyTick.includes("30")) throw new Error("why tick");
if (pub.offline.toLowerCase().includes("rank") === false) throw new Error("offline");
console.log("stack ok", { proto: PROTOCOL_VERSION, engine: ENGINE_VERSION, tick: TICK_HZ, layers: LAYERS.length });
