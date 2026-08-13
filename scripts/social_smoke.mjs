import {
  CLAN_CAP,
  allowedBy,
  clanNameOk,
  clanTagOk,
  mergeTies,
  roleRank,
  scrubChat,
  socialPublic,
} from "../shared/src/social.ts";
import { PROTOCOL_VERSION, ENGINE_VERSION } from "../shared/src/constants.ts";

if (PROTOCOL_VERSION < 9) throw new Error("version " + ENGINE_VERSION);
if (CLAN_CAP !== 50) throw new Error("cap");
if (clanTagOk("ab") !== "AB") throw new Error("tag");
if (clanTagOk("x") !== null) throw new Error("short tag");
if (clanTagOk("fuck") !== null) throw new Error("bad tag");
if (clanNameOk("Helix Wing") !== "Helix Wing") throw new Error("name");
if (roleRank("leader") <= roleRank("officer")) throw new Error("rank");
if (allowedBy("friends", { friend: false, clan: true })) throw new Error("invite friends");
if (!allowedBy("clan", { friend: false, clan: true })) throw new Error("invite clan");
if (allowedBy("nobody", { friend: true, clan: true })) throw new Error("nobody");
const dirty = scrubChat("what the fuck is this");
if (!dirty.flagged || !dirty.text.includes("•••")) throw new Error("filter " + dirty.text);
const clean = scrubChat("nice shot");
if (clean.flagged) throw new Error("false positive");
const ties = mergeTies({ blocked: ["p_x"], privacy: { invites: "anyone" } });
if (ties.privacy.whispers !== "friends") throw new Error("default whisper");
if (ties.privacy.invites !== "anyone") throw new Error("merge invite");
if (ties.privacy.showFriends !== false) throw new Error("hidden friends");
const pub = socialPublic();
if (pub.clanCap !== 50 || pub.roles.length !== 4) throw new Error("public");
if (!pub.voice.toLowerCase().includes("no proximity")) throw new Error("voice");
console.log("social ok", { proto: PROTOCOL_VERSION, engine: ENGINE_VERSION, clanCap: CLAN_CAP, filter: dirty.text });
