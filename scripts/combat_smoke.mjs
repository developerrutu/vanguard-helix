import { WebSocket } from "ws";

const HOST = process.env.HOST || "http://127.0.0.1:8787";
const WS = HOST.replace("http", "ws") + "/ws";
const BTN = { FIRE: 1 << 1, AIM: 1 << 2, GRENADE: 1 << 7, MODE: 1 << 12, CYCLE_NADE: 1 << 13 };

const out = { health: null, hits: 0, kills: 0, nades: 0, smokes: 0, modes: [], nadeIds: [], weapons: null, errors: [] };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const health = await (await fetch(HOST + "/api/health")).json();
  out.health = health;
  if (health.protocol !== 4 || health.version !== "4.0.0") {
    throw new Error("bad protocol " + JSON.stringify(health));
  }

  const sess = await (
    await fetch(HOST + "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "COMBATQA" }),
    })
  ).json();

  const ws = new WebSocket(WS);
  await new Promise((res, rej) => {
    ws.once("open", res);
    ws.once("error", rej);
  });

  let seq = 0;
  let lastSnap = null;
  const send = (msg) => ws.send(JSON.stringify(msg));
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw));
    if (m.type === "error") out.errors.push(m);
    if (m.type === "snapshot") {
      lastSnap = m.snap;
      if (m.snap.you) {
        out.modes.push(m.snap.you.fireMode);
        if (m.snap.loadout?.grenade) out.nadeIds.push(m.snap.loadout.grenade.id);
      }
      if (m.snap.smokes?.length) out.smokes = Math.max(out.smokes, m.snap.smokes.length);
    }
    if (m.type === "event") {
      for (const e of m.events) {
        if (e.kind === "hit") out.hits++;
        if (e.kind === "kill") out.kills++;
        if (e.kind === "nade") out.nades++;
      }
    }
  });

  send({ type: "hello", protocol: 4, name: "COMBATQA", token: sess.token, region: "india" });
  await sleep(80);
  send({ type: "matchmake", mode: "range" });

  const waitSnap = async () => {
    for (let i = 0; i < 40; i++) {
      if (lastSnap) return lastSnap;
      await sleep(50);
    }
    throw new Error("no snapshot");
  };
  await waitSnap();

  const input = (buttons, extra = {}) => {
    seq++;
    send({
      type: "input",
      input: {
        seq,
        dt: 1 / 30,
        moveX: 0,
        moveY: extra.moveY || 0,
        lookX: extra.lookX || 0,
        lookY: extra.lookY || 0,
        buttons,
      },
    });
  };

  // Track dummy and dump auto fire (virex).
  for (let i = 0; i < 90; i++) {
    const you = lastSnap?.you;
    const dummy = lastSnap?.others?.find((p) => p.dummy);
    let lookX = 0;
    let lookY = 0;
    if (you && dummy) {
      const wantYaw = Math.atan2(dummy.x - you.x, dummy.z - you.z);
      let dyaw = wantYaw - you.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      lookX = Math.max(-0.4, Math.min(0.4, dyaw));
      const dist = Math.hypot(dummy.x - you.x, dummy.z - you.z);
      const wantPitch = Math.atan2(you.y + 1.5 - (dummy.y + 0.9), dist);
      lookY = Math.max(-0.2, Math.min(0.2, wantPitch - you.pitch));
    }
    input(BTN.FIRE, { lookX, lookY });
    await sleep(34);
  }

  // Cycle fire mode, then cycle nade, then throw.
  input(BTN.MODE);
  await sleep(80);
  input(0);
  await sleep(80);
  input(BTN.CYCLE_NADE);
  await sleep(80);
  input(0);
  await sleep(80);
  input(BTN.GRENADE);
  await sleep(80);
  input(0);
  await sleep(2200);

  out.you = lastSnap?.you
    ? {
        weapon: lastSnap.you.weaponName,
        fireMode: lastSnap.you.fireMode,
        ads: lastSnap.you.ads,
        flash: lastSnap.you.flash,
        opticFov: lastSnap.you.opticFov,
        grenades: lastSnap.you.grenades,
        ammo: lastSnap.you.ammo,
      }
    : null;
  out.dummy = lastSnap?.others?.find((p) => p.dummy);
  out.smokesNow = lastSnap?.smokes || [];
  out.uniqueModes = [...new Set(out.modes)];
  out.uniqueNades = [...new Set(out.nadeIds)];

  await sleep(200);
  out.weapons = await (await fetch(HOST + "/api/weapons")).json();

  ws.close();
  console.log(JSON.stringify(out, null, 2));
  if (out.hits < 1) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
