import {
  BTN,
  GROUND_Y,
  GRAVITY,
  MAX_ACCEL,
  MAX_TURN_RATE,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
} from "./constants";
import { clamp, normalize2, wrapAngle } from "./math";
import { resolveCircle, type MapData } from "./map";
import type { InputPayload } from "./protocol";
import { floorAt } from "./world";
import {
  MOVE,
  climbAt,
  findVault,
  inWater,
  locoOf,
  stanceSpeed,
  type Stance,
} from "./move";
import type { Loco } from "./operators";

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  grounded: boolean;
  stance: Stance;
  slide: number;
  slideCd: number;
  vault: number;
  vaultX: number;
  vaultZ: number;
  climb: number;
  swim: boolean;
  airY: number;
  landDrop: number;
  loco: Loco;
}

export function makeBody(x: number, z: number, yaw = 0): Body {
  return {
    x,
    y: GROUND_Y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    pitch: 0,
    grounded: true,
    stance: "stand",
    slide: 0,
    slideCd: 0,
    vault: 0,
    vaultX: x,
    vaultZ: z,
    climb: 0,
    swim: false,
    airY: GROUND_Y,
    landDrop: 0,
    loco: "idle",
  };
}

export function applyInput(body: Body, input: InputPayload, map: MapData): void {
  const dt = clamp(input.dt, 0.004, 0.05);
  const mx = clamp(input.moveX, -1, 1);
  const my = clamp(input.moveY, -1, 1);
  const lookX = clamp(input.lookX, -1.5, 1.5);
  const lookY = clamp(input.lookY, -1.5, 1.5);
  const wasAir = !body.grounded;
  body.landDrop = 0;

  const maxYaw = MAX_TURN_RATE * dt * (body.stance === "prone" ? 0.72 : 1);
  body.yaw = wrapAngle(body.yaw + clamp(lookX, -maxYaw, maxYaw));
  body.pitch = clamp(body.pitch + clamp(lookY, -maxYaw, maxYaw), -1.2, 1.2);

  if (input.buttons & BTN.PRONE) body.stance = "prone";
  else if (input.buttons & BTN.CROUCH || body.slide > 0) body.stance = "crouch";
  else body.stance = "stand";

  const wantSprint = Boolean(input.buttons & BTN.SPRINT) && body.stance === "stand" && !(input.buttons & BTN.AIM);
  const speedNow = Math.hypot(body.vx, body.vz);
  if (
    wantSprint &&
    (input.buttons & BTN.CROUCH) &&
    speedNow > 6.4 &&
    body.slide <= 0 &&
    body.slideCd <= 0 &&
    body.grounded &&
    !body.swim
  ) {
    body.slide = MOVE.slideTime;
    body.slideCd = MOVE.slideCd;
    body.stance = "crouch";
  }
  body.slide = Math.max(0, body.slide - dt);
  body.slideCd = Math.max(0, body.slideCd - dt);

  const water = inWater(body.x, body.z, map);
  const onFloor = floorAt(body.x, body.z, body.y, map.floors);
  const onDeck = Boolean(onFloor && onFloor.y >= 0.08);
  body.swim = Boolean(water) && !onDeck;
  const dive = body.swim && Boolean(input.buttons & BTN.CROUCH);

  if (body.vault > 0) {
    body.vault = Math.max(0, body.vault - dt);
    const k = 1 - body.vault / MOVE.vaultTime;
    body.x += (body.vaultX - body.x) * Math.min(1, k + 0.2);
    body.z += (body.vaultZ - body.z) * Math.min(1, k + 0.2);
    body.y = GROUND_Y + Math.sin(k * Math.PI) * 0.55;
    body.grounded = body.vault <= 0;
    if (body.vault <= 0) body.y = GROUND_Y;
    finishMove(body, map, wantSprint, water, dive);
    return;
  }

  const climb = climbAt(body.x, body.z, map);
  if (climb && (input.buttons & BTN.JUMP || input.buttons & BTN.INTERACT) && body.y < climb.h - 0.15) {
    body.climb = 1;
    body.y = Math.min(climb.h, body.y + MOVE.climb * dt);
    body.vy = 0;
    body.vx *= 0.4;
    body.vz *= 0.4;
    body.grounded = body.y >= climb.h - 0.05;
    if (body.grounded) {
      body.y = climb.h;
      body.climb = 0;
    }
    finishMove(body, map, wantSprint, water, dive);
    return;
  }
  body.climb = 0;

  if (body.grounded && input.buttons & BTN.JUMP && body.stance !== "prone" && body.slide <= 0 && !body.swim) {
    const vault = findVault(body.x, body.z, body.yaw, map);
    if (vault) {
      body.vault = MOVE.vaultTime;
      body.vaultX = vault.tx;
      body.vaultZ = vault.tz;
      body.grounded = false;
      finishMove(body, map, wantSprint, water, dive);
      return;
    }
    body.vy = MOVE.jump;
    body.grounded = false;
    body.airY = body.y;
  }

  const dir = normalize2(mx, my);
  const speed = stanceSpeed(body.stance, wantSprint, body.slide, body.swim, dive);
  const wishX = Math.sin(body.yaw) * dir.z + Math.cos(body.yaw) * dir.x;
  const wishZ = Math.cos(body.yaw) * dir.z - Math.sin(body.yaw) * dir.x;
  const accel = body.slide > 0 ? MAX_ACCEL * 0.35 : MAX_ACCEL;
  body.vx = approach(body.vx, wishX * speed, accel * dt);
  body.vz = approach(body.vz, wishZ * speed, accel * dt);

  if (body.swim && water) {
    const surface = (water.h ?? 0.85) * 0.55;
    body.vy = dive ? -1.6 : (surface - body.y) * 6;
    body.y += body.vy * dt;
    if (!dive && body.y > surface) body.y = surface;
    if (body.y < 0.15) body.y = 0.15;
    body.grounded = false;
  } else {
    body.vy -= GRAVITY * dt;
    body.y += body.vy * dt;
    const deck = floorAt(body.x + body.vx * dt, body.z + body.vz * dt, body.y, map.floors);
    const groundY = deck ? deck.y : GROUND_Y;
    if (body.y <= groundY + 0.04 && body.vy <= 0.2) {
      if (wasAir) body.landDrop = Math.max(0, body.airY - groundY);
      body.y = groundY;
      body.vy = 0;
      body.grounded = true;
      body.airY = groundY;
    } else {
      body.grounded = false;
      body.airY = Math.max(body.airY, body.y);
    }
  }

  body.x += body.vx * dt;
  body.z += body.vz * dt;
  const resolved = resolveCircle(body.x, body.z, PLAYER_RADIUS, map);
  if (resolved.x !== body.x) body.vx = 0;
  if (resolved.z !== body.z) body.vz = 0;
  body.x = resolved.x;
  body.z = resolved.z;
  finishMove(body, map, wantSprint, water, dive);
}

function finishMove(body: Body, _map: MapData, sprint: boolean, water: unknown, _dive: boolean): void {
  const spd = Math.hypot(body.vx, body.vz);
  body.loco = locoOf({
    grounded: body.grounded,
    stance: body.stance,
    sprint,
    slide: body.slide,
    vault: body.vault,
    climb: body.climb,
    swim: Boolean(water) || body.swim,
    speed: spd,
  });
  void PLAYER_HEIGHT;
}

function approach(cur: number, target: number, maxDelta: number): number {
  const d = target - cur;
  if (Math.abs(d) <= maxDelta) return target;
  return cur + Math.sign(d) * maxDelta;
}

export function eyeHeight(body?: Body): number {
  if (!body) return PLAYER_HEIGHT * 0.88;
  if (body.slide > 0) return 0.55;
  if (body.stance === "prone") return 0.28;
  if (body.stance === "crouch") return 0.92;
  return PLAYER_HEIGHT * 0.88;
}

export function copyBody(b: Body): Body {
  return { ...b };
}
