import { BTN } from "@shared";
import { bindOf, type InputAction, type Settings, type TouchAct } from "../boot/settings";

export interface InputFrame {
  seq: number;
  dt: number;
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  buttons: number;
}

const ACT_BTN: Partial<Record<InputAction, number>> = {
  jump: BTN.JUMP,
  sprint: BTN.SPRINT,
  crouch: BTN.CROUCH,
  prone: BTN.PRONE,
  fire: BTN.FIRE,
  aim: BTN.AIM,
  reload: BTN.RELOAD,
  interact: BTN.INTERACT,
  use: BTN.USE,
  grenade: BTN.GRENADE,
  ping: BTN.PING,
  slot1: BTN.SLOT1,
  slot2: BTN.SLOT2,
  slot3: BTN.SLOT3,
  mode: BTN.MODE,
  nadeCycle: BTN.CYCLE_NADE,
  emote: BTN.EMOTE,
};

export class InputManager {
  chat: ((code: "enemy" | "ammo" | "heal" | "defend" | "move" | "follow" | "retreat") => void) | null = null;
  voice: ((on: boolean) => void) | null = null;
  leftHanded = false;
  moveX = 0;
  moveY = 0;
  device: "touch" | "kbm" | "pad" = "kbm";
  private lookAccX = 0;
  private lookAccY = 0;
  private buttons = 0;
  private keys = new Set<string>();
  private seq = 0;
  sensitivity = 1;
  adsSens = 0.85;
  invertY = false;
  gyro = false;
  gyroSens = 1;
  stickSens = 1;
  autoSprint = false;
  ads = false;
  private pointerLocked = false;
  enabled = false;
  private unbind: Array<() => void> = [];
  settings: Settings | null = null;
  private touchingStick = false;
  private lastPad = 0;

  attach(opts: { canvas: HTMLCanvasElement; touchRoot: HTMLElement; isTouch: boolean }): void {
    this.detach();
    if (opts.isTouch) this.device = "touch";
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.repeat) return;
      this.device = "kbm";
      if (down) this.keys.add(e.code);
      else this.keys.delete(e.code);
      if (["Space", "Tab"].includes(e.code)) e.preventDefault();
      const s = this.settings;
      const hit = (act: InputAction) => (s ? bindOf(s, act) : "") === e.code;
      for (const [act, bit] of Object.entries(ACT_BTN) as [InputAction, number][]) {
        if (hit(act)) this.setBtn(bit, down);
      }
      if (hit("voice")) this.voice?.(down);
      if (down && e.code === "KeyZ") this.chat?.("enemy");
      if (down && e.code === "KeyX") this.chat?.("ammo");
      if (down && e.code === "KeyC") this.chat?.("heal");
      if (down && e.code === "KeyB") this.chat?.("follow");
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    this.unbind.push(() => window.removeEventListener("keydown", kd));
    this.unbind.push(() => window.removeEventListener("keyup", ku));

    const md = (e: MouseEvent) => {
      this.device = "kbm";
      if (e.button === 0) this.setBtn(BTN.FIRE, true);
      if (e.button === 2) this.setBtn(BTN.AIM, true);
      if (!this.pointerLocked && this.enabled) opts.canvas.requestPointerLock?.();
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) this.setBtn(BTN.FIRE, false);
      if (e.button === 2) this.setBtn(BTN.AIM, false);
    };
    const mm = (e: MouseEvent) => {
      if (!this.pointerLocked || !this.enabled) return;
      const ads = this.ads ? this.adsSens : 1;
      this.lookAccX += e.movementX * 0.0022 * this.sensitivity * ads;
      const y = e.movementY * 0.0022 * this.sensitivity * ads;
      this.lookAccY += this.invertY ? -y : y;
    };
    const ctx = (e: Event) => e.preventDefault();
    opts.canvas.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    window.addEventListener("mousemove", mm);
    opts.canvas.addEventListener("contextmenu", ctx);
    this.unbind.push(() => opts.canvas.removeEventListener("mousedown", md));
    this.unbind.push(() => window.removeEventListener("mouseup", mu));
    this.unbind.push(() => window.removeEventListener("mousemove", mm));
    this.unbind.push(() => opts.canvas.removeEventListener("contextmenu", ctx));

    const onLock = () => {
      this.pointerLocked = document.pointerLockElement === opts.canvas;
    };
    document.addEventListener("pointerlockchange", onLock);
    this.unbind.push(() => document.removeEventListener("pointerlockchange", onLock));

    if (opts.isTouch) this.bindTouch(opts.touchRoot);
    this.bindGyro();

    window.addEventListener("blur", () => this.reset());
    this.unbind.push(() => window.removeEventListener("blur", this.reset));
  }

  detach(): void {
    for (const fn of this.unbind) fn();
    this.unbind = [];
    this.reset();
  }

  reset = (): void => {
    this.keys.clear();
    this.moveX = 0;
    this.moveY = 0;
    this.lookAccX = 0;
    this.lookAccY = 0;
    this.buttons = 0;
  };

  sample(dt: number): InputFrame {
    this.pollKeyboardMove();
    this.pollGamepad(dt);
    if (this.autoSprint && (Math.abs(this.moveX) > 0.4 || Math.abs(this.moveY) > 0.4)) this.setBtn(BTN.SPRINT, true);
    const lookX = this.lookAccX;
    const lookY = this.lookAccY;
    this.lookAccX = 0;
    this.lookAccY = 0;
    this.seq++;
    return {
      seq: this.seq,
      dt,
      moveX: clamp(this.moveX, -1, 1),
      moveY: clamp(this.moveY, -1, 1),
      lookX,
      lookY,
      buttons: this.buttons,
    };
  }

  applyTouchLayout(root: HTMLElement, slots: Partial<Record<TouchAct, { x: number; y: number; s: number; a: number }>>): void {
    const map: Record<string, TouchAct | "look"> = {
      fire: "fire",
      aim: "aim",
      jump: "jump",
      sprint: "sprint",
      crouch: "crouch",
      prone: "prone",
      reload: "reload",
      interact: "interact",
      use: "use",
      nade: "nade",
      swap: "swap",
      ping: "ping",
    };
    root.querySelectorAll<HTMLElement>("[data-act]").forEach((el) => {
      const act = map[el.dataset.act || ""];
      if (!act || act === "look") return;
      const slot = slots[act];
      if (!slot) return;
      el.style.left = slot.x + "%";
      el.style.top = slot.y + "%";
      el.style.transform = `translate(-50%, -50%) scale(${slot.s})`;
      el.style.opacity = String(slot.a);
      el.style.right = "auto";
      el.style.bottom = "auto";
    });
  }

  private pollKeyboardMove(): void {
    const s = this.settings;
    const fwd = s ? bindOf(s, "forward") : "KeyW";
    const back = s ? bindOf(s, "back") : "KeyS";
    const left = s ? bindOf(s, "left") : "KeyA";
    const right = s ? bindOf(s, "right") : "KeyD";
    let x = 0;
    let y = 0;
    if (this.keys.has(left) || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has(right) || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has(fwd) || this.keys.has("ArrowUp")) y += 1;
    if (this.keys.has(back) || this.keys.has("ArrowDown")) y -= 1;
    if (x || y) {
      const l = Math.hypot(x, y);
      this.moveX = x / l;
      this.moveY = y / l;
    } else if (!this.touchingStick) {
      this.moveX = 0;
      this.moveY = 0;
    }
  }

  private pollGamepad(dt: number): void {
    const pads = navigator.getGamepads?.() || [];
    const g = pads.find(Boolean);
    if (!g) return;
    this.device = "pad";
    this.lastPad = performance.now();
    const lx = dead(g.axes[0] || 0, 0.18);
    const ly = dead(g.axes[1] || 0, 0.18);
    if (Math.abs(lx) + Math.abs(ly) > 0) {
      this.moveX = lx;
      this.moveY = -ly;
    }
    const rx = dead(g.axes[2] || 0, 0.16);
    const ry = dead(g.axes[3] || 0, 0.16);
    const ads = this.ads ? this.adsSens : 1;
    this.lookAccX += rx * 2.4 * this.sensitivity * this.stickSens * ads * dt;
    const y = ry * 2.0 * this.sensitivity * this.stickSens * ads * dt;
    this.lookAccY += this.invertY ? -y : y;
    const trig = this.settings?.triggerSens ?? 1;
    this.setBtn(BTN.FIRE, (g.buttons[7]?.value || 0) * trig > 0.35 || g.buttons[7]?.pressed);
    this.setBtn(BTN.AIM, (g.buttons[6]?.value || 0) * trig > 0.35 || g.buttons[6]?.pressed);
    this.setBtn(BTN.JUMP, g.buttons[0]?.pressed || false);
    this.setBtn(BTN.SPRINT, g.buttons[10]?.pressed || g.buttons[4]?.pressed);
    this.setBtn(BTN.INTERACT, g.buttons[2]?.pressed || false);
    this.setBtn(BTN.USE, g.buttons[3]?.pressed || false);
    this.setBtn(BTN.RELOAD, g.buttons[2]?.pressed || false);
    this.setBtn(BTN.GRENADE, g.buttons[5]?.pressed || false);
    this.setBtn(BTN.CROUCH, g.buttons[1]?.pressed || g.buttons[13]?.pressed || false);
    this.setBtn(BTN.PRONE, g.buttons[12]?.pressed || false);
    if (this.settings?.rumble && g.vibrationActuator && this.buttons & BTN.FIRE) {
      void g.vibrationActuator.playEffect?.("dual-rumble", { duration: 18, strongMagnitude: 0.15, weakMagnitude: 0.08 });
    }
  }

  private bindGyro(): void {
    const onOri = (e: DeviceOrientationEvent) => {
      if (!this.gyro || !this.enabled) return;
      const gx = (e.gamma || 0) * 0.0009 * this.gyroSens;
      const gy = (e.beta || 0) * 0.00035 * this.gyroSens;
      this.lookAccX += gx;
      this.lookAccY += this.invertY ? -gy : gy;
    };
    window.addEventListener("deviceorientation", onOri);
    this.unbind.push(() => window.removeEventListener("deviceorientation", onOri));
  }

  private bindTouch(root: HTMLElement): void {
    const stick = root.querySelector("#stick") as HTMLElement;
    const knob = root.querySelector("#stick-knob") as HTMLElement;
    const look = root.querySelector("#lookpad") as HTMLElement;
    if (!stick || !knob || !look) return;
    let stickId: number | null = null;
    let lookId: number | null = null;
    let lookLastX = 0;
    let lookLastY = 0;

    const onStick = (x: number, y: number) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const radius = Math.max(36, r.width / 2 - 4);
      let dx = x - cx;
      let dy = y - cy;
      const l = Math.hypot(dx, dy);
      if (l > radius) {
        dx = (dx / l) * radius;
        dy = (dy / l) * radius;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      // Screen right = +X = strafe right. Screen up = -Y = forward.
      this.moveX = dx / radius;
      this.moveY = -dy / radius;
      this.touchingStick = true;
    };

    const endStick = () => {
      stickId = null;
      this.touchingStick = false;
      this.moveX = 0;
      this.moveY = 0;
      knob.style.transform = "translate(-50%, -50%)";
    };

    stick.addEventListener("pointerdown", (e) => {
      this.device = "touch";
      stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      onStick(e.clientX, e.clientY);
    });
    stick.addEventListener("pointermove", (e) => {
      if (e.pointerId === stickId) onStick(e.clientX, e.clientY);
    });
    stick.addEventListener("pointerup", endStick);
    stick.addEventListener("pointercancel", endStick);

    look.addEventListener("pointerdown", (e) => {
      lookId = e.pointerId;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      look.setPointerCapture(e.pointerId);
    });
    look.addEventListener("pointermove", (e) => {
      if (e.pointerId !== lookId) return;
      const dx = e.clientX - lookLastX;
      const dy = e.clientY - lookLastY;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      const ads = this.ads ? this.adsSens : 1;
      this.lookAccX += dx * 0.007 * this.sensitivity * ads;
      const y = dy * 0.007 * this.sensitivity * ads;
      this.lookAccY += this.invertY ? -y : y;
    });
    const endLook = () => {
      lookId = null;
    };
    look.addEventListener("pointerup", endLook);
    look.addEventListener("pointercancel", endLook);

    root.querySelectorAll<HTMLElement>("[data-act]").forEach((btn) => {
      const act = btn.dataset.act!;
      const map: Record<string, number> = {
        fire: BTN.FIRE,
        jump: BTN.JUMP,
        sprint: BTN.SPRINT,
        interact: BTN.INTERACT,
        use: BTN.USE,
        reload: BTN.RELOAD,
        nade: BTN.GRENADE,
        mode: BTN.MODE,
        cyclenade: BTN.CYCLE_NADE,
        aim: BTN.AIM,
        crouch: BTN.CROUCH,
        prone: BTN.PRONE,
        emote: BTN.EMOTE,
        ping: BTN.PING,
        swap: BTN.SLOT1,
      };
      const bit = map[act];
      if (!bit) return;
      const down = (e: Event) => {
        e.preventDefault();
        this.setBtn(bit, true);
      };
      const up = () => this.setBtn(bit, false);
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointerleave", up);
      btn.addEventListener("pointercancel", up);
    });
  }

  private setBtn(bit: number, down: boolean): void {
    if (down) this.buttons |= bit;
    else this.buttons &= ~bit;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function dead(v: number, z: number): number {
  return Math.abs(v) < z ? 0 : v;
}
