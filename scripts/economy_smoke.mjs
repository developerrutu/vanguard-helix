import {
  DAILY_ION,
  ION_NAME,
  ORBIT_NAME,
  PASS_TIERS,
  VAULT,
  economyPublic,
  featuredIds,
  isCombatSku,
  passTierOf,
  quoteOf,
  vaultById,
} from "../shared/src/economy.ts";
import { ENGINE_VERSION, PROTOCOL_VERSION } from "../shared/src/constants.ts";

if (PROTOCOL_VERSION < 13) throw new Error("version");
if (ION_NAME !== "ION" || ORBIT_NAME !== "ORBIT") throw new Error("names");
if (PASS_TIERS !== 100) throw new Error("tiers");
if (DAILY_ION < 10) throw new Error("daily");
if (!isCombatSku("buy_repair") || isCombatSku("apex")) throw new Error("combat gate");
if (quoteOf("buy_repair")) throw new Error("no power quote");
const dune = quoteOf("bundle_dune");
if (!dune || dune.save <= 0 || !dune.cosmetic) throw new Error("bundle quote");
const apex = vaultById("apex");
if (!apex || apex.coin !== "orbit" || apex.luma < 0.18) throw new Error("apex");
if (VAULT.some((v) => v.luma < 0.18)) throw new Error("invis");
if (featuredIds(Date.parse("2026-08-13T00:00:00Z")).length !== 4) throw new Error("feat");
if (passTierOf(800) !== 10) throw new Error("pass xp");
const pub = economyPublic();
if (!pub.rule.toLowerCase().includes("cosmetic")) throw new Error("rule");
if (pub.trade !== "disabled" || pub.gift !== "disabled") throw new Error("trade");
if (!pub.lootBoxes.includes("none")) throw new Error("boxes");
console.log("economy ok", { proto: PROTOCOL_VERSION, items: VAULT.length, save: dune.save });
