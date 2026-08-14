import * as THREE from "three";
import {
  HAIR_TONES,
  ORBIT_YARD,
  RARITY_COLOR,
  SKIN_TONES,
  TRAINING_RANGE,
  WEATHER_LOOK,
  operatorById,
  outfitTint,
  worldById,
  type PickupPublic,
  type PlayerPublic,
  type WeatherId,
  type WorldDef,
  type ZonePublic,
} from "@shared";
import type { QualityProfile } from "../boot/capabilities";

interface Actor {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  visor: THREE.Mesh;
  lArm: THREE.Object3D;
  rArm: THREE.Object3D;
  lLeg: THREE.Object3D;
  rLeg: THREE.Object3D;
  ring: THREE.Mesh;
  char: string;
  phase: number;
}

export class GameRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.08, 280);
  private players = new Map<string, Actor>();
  private pickups = new Map<string, THREE.Group>();
  private tracers: { mesh: THREE.Line; life: number }[] = [];
  private clock = new THREE.Clock();
  private dir: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private grid: THREE.GridHelper | null = null;
  private localId = "";
  private camYaw = 0;
  private camPitch = 0.28;
  private shake = 0;
  private quality: QualityProfile;
  private zoneRing: THREE.Mesh | null = null;
  private nextRing: THREE.Mesh | null = null;
  private world: THREE.Group | null = null;
  private usingBr = false;
  private adsMul = 1;
  private smokes = new Map<string, THREE.Mesh>();
  private waters: THREE.Mesh[] = [];
  private baseFov = 68;
  private mapId = "range";
  private weather: WeatherId | "" = "";
  private doorMeshes = new Map<string, THREE.Mesh>();
  private glassMeshes = new Map<string, THREE.Mesh>();
  private propMeshes = new Map<string, THREE.Mesh>();
  private weatherPts: THREE.Points | null = null;
  private weatherKind: "none" | "rain" | "snow" | "dust" = "none";
  colorblind: "none" | "protan" | "deutan" | "tritan" = "none";
  reduceShake = false;
  menuLite = false;

  constructor(canvas: HTMLCanvasElement, quality: QualityProfile) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.antialias,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality.shadows !== "off";
    this.renderer.shadowMap.type = quality.shadows === "high" ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;

    this.scene.background = new THREE.Color("#07090f");
    this.scene.fog = new THREE.Fog("#07090f", 18, quality.drawDistance);

    this.hemi = new THREE.HemisphereLight("#9eb6ff", "#1a140c", 0.55);
    this.scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight("#e9f4ff", 1.15);
    this.dir.position.set(18, 28, 10);
    this.dir.castShadow = quality.shadows !== "off";
    if (this.dir.castShadow) {
      const s = quality.shadows === "high" ? 2048 : quality.shadows === "mid" ? 1024 : 512;
      this.dir.shadow.mapSize.set(s, s);
      this.dir.shadow.camera.near = 2;
      this.dir.shadow.camera.far = 120;
      this.dir.shadow.camera.left = -50;
      this.dir.shadow.camera.right = 50;
      this.dir.shadow.camera.top = 50;
      this.dir.shadow.camera.bottom = -50;
    }
    this.scene.add(this.dir);

    this.useWorld("iron_city", "clear");
    window.addEventListener("resize", () => this.resize());
    window.visualViewport?.addEventListener("resize", () => this.resize());
    this.resize();
  }

  useBrMap(on: boolean): void {
    if (on) this.useWorld("iron_city", "clear");
    else this.useWorld("range", "");
  }

  useWorld(
    mapId: string,
    weather: WeatherId | "",
    doors?: { id: string; open: boolean }[],
    broken?: string[],
    rubble?: string[],
  ): void {
    const nextW = (weather || "clear") as WeatherId;
    if (this.mapId !== mapId || this.weather !== nextW) {
      this.mapId = mapId;
      this.weather = nextW;
      this.usingBr = mapId !== "range";
      this.buildWorld(mapId, nextW);
    }
    this.syncInteract(doors || [], broken || [], rubble || []);
  }

  applyQuality(q: QualityProfile): void {
    this.quality = q;
    this.renderer.setPixelRatio(q.pixelRatio);
    this.renderer.shadowMap.enabled = q.shadows !== "off";
    this.resize();
  }

  setPixelRatioSafe(scale = 1): void {
    this.renderer.setPixelRatio(Math.min(this.quality.pixelRatio * scale, 3));
    this.resize();
  }

  setLocal(id: string): void {
    this.localId = id;
  }

  resize(): void {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width || window.innerWidth);
    const h = Math.max(1, Math.round(vv?.height || window.innerHeight));
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.baseFov = aspect > 2 ? 58 : aspect < 1.4 ? 74 : 68;
    this.camera.fov = this.baseFov * this.adsMul;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  syncPlayers(you: PlayerPublic, others: PlayerPublic[]): void {
    const all = [you, ...others];
    const seen = new Set<string>();
    for (const p of all) {
      seen.add(p.id);
      let a = this.players.get(p.id);
      if (!a || a.char !== (p.character || "") + (p.appearance?.outfit || "")) {
        if (a) this.scene.remove(a.root);
        a = this.makeActor(p);
        this.players.set(p.id, a);
        this.scene.add(a.root);
      }
      if (p.id !== this.localId) {
        a.root.position.lerp(new THREE.Vector3(p.x, p.y, p.z), 0.35);
        a.root.rotation.y = p.yaw;
      }
      const hiddenBySmoke = p.id !== this.localId && this.lineInSmoke(you.x, you.z, p.x, p.z);
      a.root.visible = (p.alive || p.downed) && !p.eliminated && !hiddenBySmoke;
      a.root.scale.y = p.downed ? 0.35 : 1;
      const hp = Math.max(0.15, p.health / 100);
      const col = this.teamHex(p);
      (a.ring.material as THREE.MeshBasicMaterial).color.set(col);
      (a.visor.material as THREE.MeshStandardMaterial).emissive.set(col);
      a.ring.scale.setScalar(0.7 + hp * 0.4);
    }
    for (const [id, a] of this.players) {
      if (!seen.has(id)) {
        this.scene.remove(a.root);
        this.players.delete(id);
      }
    }
  }

  syncPickups(list: PickupPublic[]): void {
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      let g = this.pickups.get(p.id);
      if (!g) {
        g = this.makeCrate(p.rarity || p.kind);
        this.pickups.set(p.id, g);
        this.scene.add(g);
      }
      g.position.set(p.x, 0.45, p.z);
      g.visible = p.live;
      g.rotation.y += 0.01;
    }
    for (const [id, g] of this.pickups) {
      if (!seen.has(id)) {
        this.scene.remove(g);
        this.pickups.delete(id);
      }
    }
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color: string): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ mesh: line, life: 0.08 });
  }

  setAds(mul: number): void {
    this.adsMul = THREE.MathUtils.clamp(mul, 0.32, 1);
    this.camera.fov = this.baseFov * this.adsMul;
    this.camera.updateProjectionMatrix();
  }

  syncSmokes(list: { x: number; z: number; r: number }[]): void {
    const seen = new Set<string>();
    list.forEach((s) => {
      const id = `${s.x.toFixed(1)}_${s.z.toFixed(1)}`;
      seen.add(id);
      let m = this.smokes.get(id);
      if (!m) {
        m = new THREE.Mesh(
          new THREE.SphereGeometry(1, 12, 10),
          new THREE.MeshBasicMaterial({ color: "#c8d0d8", transparent: true, opacity: 0.28, depthWrite: false }),
        );
        this.scene.add(m);
        this.smokes.set(id, m);
      }
      m.position.set(s.x, 1.6, s.z);
      m.scale.setScalar(s.r);
    });
    for (const [id, m] of this.smokes) {
      if (seen.has(id)) continue;
      this.scene.remove(m);
      this.smokes.delete(id);
    }
  }

  impulse(n = 0.12): void {
    if (this.reduceShake) return;
    this.shake = Math.max(this.shake, n);
  }

  setMenuLite(on: boolean): void {
    this.menuLite = on;
    if (this.weatherPts) this.weatherPts.visible = !on;
  }

  showcase(you: PlayerPublic | null): void {
    if (this.menuLite || !you) return;
    this.syncPlayers(you, []);
    const a = this.players.get(you.id);
    if (a) {
      a.root.visible = true;
      this.pose(a, you, 0.016);
    }
  }

  private lineInSmoke(ax: number, az: number, bx: number, bz: number): boolean {
    for (const m of this.smokes.values()) {
      const cx = m.position.x;
      const cz = m.position.z;
      const r = m.scale.x * 0.92;
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        if (Math.hypot(x - cx, z - cz) < r) return true;
      }
    }
    return false;
  }

  render(you: PlayerPublic | null): void {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.tickWeather(dt);
    if (you) {
      this.camYaw = you.yaw;
      this.camPitch = THREE.MathUtils.clamp(you.pitch + 0.18, -0.6, 0.85);
      const back = 4.4;
      const height = you.stance === "prone" ? 0.55 : you.stance === "crouch" || you.loco === "slide" ? 1.05 : 1.55;
      const ox = -Math.sin(this.camYaw) * back;
      const oz = -Math.cos(this.camYaw) * back;
      const oy = height + Math.sin(this.camPitch) * 1.2;
      const lookY = you.stance === "prone" ? 0.35 : you.stance === "crouch" ? 0.85 : 1.15;
      const target = new THREE.Vector3(you.x, you.y + lookY, you.z);
      this.camera.position.set(you.x + ox, you.y + oy, you.z + oz);
      if (this.shake > 0 && !this.reduceShake) {
        this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.2;
        this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.12;
        this.shake *= 0.6;
      } else this.shake *= 0.45;
      this.camera.lookAt(target);
      const self = this.players.get(you.id);
      if (self) {
        self.root.visible = true;
        self.root.position.set(you.x, you.y, you.z);
        self.root.rotation.y = you.yaw;
        this.pose(self, you, dt);
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      (tr.mesh.material as THREE.LineBasicMaterial).opacity = Math.max(0, tr.life * 8);
      if (tr.life <= 0) {
        this.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        (tr.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  syncZone(z: ZonePublic | null): void {
    if (!z) {
      if (this.zoneRing) this.zoneRing.visible = false;
      if (this.nextRing) this.nextRing.visible = false;
      return;
    }
    if (!this.zoneRing) {
      const geo = new THREE.RingGeometry(0.95, 1, 96);
      this.zoneRing = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: "#ffc14d", side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
      );
      this.zoneRing.rotation.x = -Math.PI / 2;
      this.scene.add(this.zoneRing);
      this.nextRing = new THREE.Mesh(
        geo.clone(),
        new THREE.MeshBasicMaterial({ color: "#3dffc0", side: THREE.DoubleSide, transparent: true, opacity: 0.28 }),
      );
      this.nextRing.rotation.x = -Math.PI / 2;
      this.scene.add(this.nextRing);
    }
    this.zoneRing.visible = true;
    this.zoneRing.position.set(z.cx, 0.05, z.cz);
    this.zoneRing.scale.set(z.radius, z.radius, 1);
    if (this.nextRing) {
      this.nextRing.visible = true;
      this.nextRing.position.set(z.nextCx, 0.06, z.nextCz);
      this.nextRing.scale.set(Math.max(0.4, z.nextRadius), Math.max(0.4, z.nextRadius), 1);
    }
  }

  private resolveMap(id: string): WorldDef | typeof TRAINING_RANGE | typeof ORBIT_YARD {
    if (id === "range") return TRAINING_RANGE;
    if (id === "orbit_yard") return ORBIT_YARD;
    return worldById(id);
  }

  private buildWorld(mapId: string, weather: WeatherId): void {
    if (this.world) {
      this.scene.remove(this.world);
      this.world.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    }
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid = null;
    }
    if (this.weatherPts) {
      this.scene.remove(this.weatherPts);
      this.weatherPts.geometry.dispose();
      this.weatherPts = null;
    }
    this.doorMeshes.clear();
    this.glassMeshes.clear();
    this.propMeshes.clear();
    this.waters = [];

    this.world = new THREE.Group();
    this.scene.add(this.world);
    const raw = this.resolveMap(mapId);
    const world = "palette" in raw ? raw : null;
    const pal = world?.palette || {
      ground: "#12151d",
      wall: "#161b26",
      accent: "#0d1a18",
      fog: "#07090f",
      sky: "#07090f",
      hemi: "#9eb6ff",
      sun: "#e9f4ff",
      water: "#1a3a52",
    };
    const look = WEATHER_LOOK[weather] || WEATHER_LOOK.clear;
    const sky = look.sky || pal.sky;
    const sun = look.sun || pal.sun;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(look.sky || pal.fog, look.fog, Math.min(this.quality.drawDistance + 40, look.fogFar));
    this.hemi.color.set(pal.hemi);
    this.hemi.groundColor.set(pal.ground);
    this.hemi.intensity = 0.55 * look.dim;
    this.dir.color.set(sun);
    this.dir.intensity = 1.15 * look.dim;
    this.dir.position.set(weather === "sunset" ? 28 : 18, weather === "night" ? 14 : 32, weather === "sunset" ? -8 : 10);
    this.renderer.toneMappingExposure = weather === "night" ? 0.72 : weather === "sunset" ? 1.12 : 1.05;

    const floorMat = new THREE.MeshStandardMaterial({
      color: pal.ground,
      roughness: mapId === "red_sands" ? 0.98 : mapId === "frost_haven" ? 0.72 : 0.92,
      metalness: mapId === "iron_city" ? 0.14 : 0.04,
    });
    const size = raw.half * 2 + 10;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.world.add(floor);

    if (this.quality.grid && mapId === "range") {
      this.grid = new THREE.GridHelper(44, 44, "#1d3b33", "#141821");
      this.grid.position.y = 0.01;
      this.world.add(this.grid);
    }

    const wallMat = new THREE.MeshStandardMaterial({
      color: pal.wall,
      roughness: 0.78,
      metalness: mapId === "iron_city" ? 0.28 : 0.12,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: pal.accent,
      emissive: mapId === "iron_city" ? "#0b3d30" : "#000000",
      emissiveIntensity: mapId === "iron_city" ? 0.45 : 0,
      roughness: 0.5,
      metalness: 0.35,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: mapId === "frost_haven" ? "#eef4f8" : mapId === "red_sands" ? "#6a4a2c" : "#1c2430",
      roughness: 0.7,
      metalness: 0.2,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: "#8ec8ff",
      transparent: true,
      opacity: 0.28,
      roughness: 0.08,
      metalness: 0.6,
    });
    const doorMat = new THREE.MeshStandardMaterial({ color: "#3a2a1c", roughness: 0.6, metalness: 0.25 });

    const addBox = (x: number, z: number, hx: number, hz: number, h: number, mat: THREE.Material, y0 = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, h, hz * 2), mat);
      m.position.set(x, y0 + h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.world!.add(m);
      return m;
    };

    for (const w of raw.walls) addBox(w.x, w.z, w.hx, w.hz, w.h ?? 3.4, wallMat);
    for (const p of raw.props) {
      const mesh = addBox(p.x, p.z, p.hx, p.hz, p.h ?? 1.15, accent);
      this.propMeshes.set(`${p.x.toFixed(1)}_${p.z.toFixed(1)}`, mesh);
    }
    for (const f of raw.floors || []) addBox(f.x, f.z, f.hx, f.hz, 0.12, roofMat, f.y);
    for (const d of raw.doors || []) {
      const mesh = addBox(d.x, d.z, d.hx, d.hz, 2.3, doorMat);
      mesh.userData.closedYaw = d.yaw;
      this.doorMeshes.set(d.id, mesh);
    }
    for (const g of raw.glass || []) {
      const mesh = addBox(g.x, g.z, g.hx, g.hz, g.h, glassMat, 0.9);
      this.glassMeshes.set(g.id, mesh);
    }
    for (const w of raw.water || []) {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(w.hx * 2, w.hz * 2),
        new THREE.MeshStandardMaterial({
          color: pal.water,
          transparent: true,
          opacity: 0.55,
          roughness: 0.18,
          metalness: 0.45,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(w.x, (w.h ?? 0.7) * 0.45, w.z);
      this.world.add(water);
      this.waters.push(water);
    }

    if (world) {
      for (const lm of world.landmarks) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.16, 6.4, 6),
          new THREE.MeshStandardMaterial({ color: pal.accent, emissive: "#3dffc0", emissiveIntensity: 0.35 }),
        );
        pole.position.set(lm.x, 3.2, lm.z);
        this.world.add(pole);
        if (lm.id === "dish" || lm.id === "mast") {
          const dish = new THREE.Mesh(
            new THREE.SphereGeometry(1.8, 10, 8, 0, Math.PI * 2, 0, 1.2),
            new THREE.MeshStandardMaterial({ color: "#c8d0d8", metalness: 0.7, roughness: 0.3 }),
          );
          dish.position.set(lm.x, 7.4, lm.z);
          this.world.add(dish);
        }
        if (lm.id === "spire") {
          const tip = addBox(lm.x, lm.z, 0.7, 0.7, 14, wallMat);
          tip.position.y = 7;
        }
      }
    }

    this.weatherKind = look.particles;
    const count =
      look.particles === "none" || this.quality.particles <= 0
        ? 0
        : this.quality.particles >= 40
          ? 900
          : this.quality.particles >= 20
            ? 420
            : 180;
    if (count > 0) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * raw.half * 2;
        pos[i * 3 + 1] = Math.random() * 18;
        pos[i * 3 + 2] = (Math.random() - 0.5) * raw.half * 2;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const col = look.particles === "dust" ? "#c9b07a" : look.particles === "snow" ? "#eef6ff" : "#9ab4c8";
      this.weatherPts = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: col, size: look.particles === "rain" ? 0.08 : 0.14, transparent: true, opacity: 0.55 }),
      );
      this.scene.add(this.weatherPts);
    }
    void this.usingBr;
  }

  private syncInteract(doors: { id: string; open: boolean }[], broken: string[], rubble: string[]): void {
    for (const d of doors) {
      const m = this.doorMeshes.get(d.id);
      if (!m) continue;
      m.rotation.y = d.open ? (m.userData.closedYaw || 0) + 1.35 : m.userData.closedYaw || 0;
    }
    for (const [id, m] of this.glassMeshes) m.visible = !broken.includes(id);
    for (const [key, m] of this.propMeshes) m.visible = !rubble.includes(key);
  }

  private tickWeather(dt: number): void {
    if (!this.weatherPts) return;
    const pos = this.weatherPts.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const fall = this.weatherKind === "rain" ? 28 : this.weatherKind === "snow" ? 4.5 : 1.6;
    const drift = this.weatherKind === "dust" ? 3.2 : this.weatherKind === "snow" ? 1.4 : 0.4;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += drift * dt;
      arr[i + 1] -= fall * dt;
      arr[i + 2] += drift * 0.4 * dt;
      if (arr[i + 1] < 0) {
        arr[i] = (Math.random() - 0.5) * 140;
        arr[i + 1] = 16 + Math.random() * 6;
        arr[i + 2] = (Math.random() - 0.5) * 140;
      }
    }
    pos.needsUpdate = true;
    for (const w of this.waters) w.position.y += Math.sin(this.clock.elapsedTime * 1.4 + w.position.x) * 0.0008;
  }

  private teamHex(p: PlayerPublic): string {
    if (p.dummy) return "#ff4d6a";
    const op = operatorById(p.character);
    if (this.colorblind !== "none") {
      if (p.team === "bravo") return this.colorblind === "protan" ? "#ffd24d" : "#ff9a3d";
      if (p.team === "alpha") return this.colorblind === "tritan" ? "#7aa7ff" : "#3dffc0";
    }
    if (p.team === "bravo") return "#ff4d6a";
    if (p.team === "alpha") return "#3dffc0";
    return op.accent;
  }

  private pose(a: Actor, p: PlayerPublic, dt: number): void {
    a.phase += dt * (p.loco === "sprint" ? 14 : p.loco === "run" || p.loco === "walk" ? 9 : 4);
    const swing = Math.sin(a.phase) * (p.loco === "idle" || p.loco === "emote" ? 0.04 : 0.55);
    const crouch = p.stance === "crouch" || p.loco === "slide" ? 0.55 : p.stance === "prone" ? 0.18 : 1;
    a.pelvis.scale.y = THREE.MathUtils.lerp(a.pelvis.scale.y, crouch, 0.25);
    a.pelvis.rotation.x = p.stance === "prone" ? 1.25 : p.loco === "slide" ? 0.55 : p.loco === "swim" ? 0.7 : 0;
    a.lArm.rotation.x = p.loco === "emote" ? -2.2 : p.reloading ? -1.2 : swing;
    a.rArm.rotation.x = p.loco === "emote" ? -2.0 : p.ads ? -0.8 : -swing;
    a.lLeg.rotation.x = p.loco === "swim" ? Math.sin(a.phase) * 0.4 : -swing * 0.7;
    a.rLeg.rotation.x = p.loco === "swim" ? Math.cos(a.phase) * 0.4 : swing * 0.7;
    if (p.downed || p.eliminated) {
      a.root.rotation.z = THREE.MathUtils.lerp(a.root.rotation.z, 1.4, 0.12);
    } else {
      a.root.rotation.z = THREE.MathUtils.lerp(a.root.rotation.z, 0, 0.2);
    }
    if (p.loco === "jump" || p.loco === "fall") {
      a.lLeg.rotation.x = 0.4;
      a.rLeg.rotation.x = -0.2;
    }
    (a.visor.material as THREE.MeshStandardMaterial).emissiveIntensity = p.emote ? 2.2 : 1.3;
  }

  private makeActor(p: PlayerPublic): Actor {
    const root = new THREE.Group();
    const pelvis = new THREE.Group();
    const op = operatorById(p.character);
    const suit = outfitTint(p.appearance || ({ outfit: "duty" } as PlayerPublic["appearance"]));
    const skin = SKIN_TONES[p.appearance?.skin ?? 2] || "#c9956b";
    const hair = HAIR_TONES[p.appearance?.hair ?? 0] || "#1a1a1a";
    const female = (p.bodyType || op.body) === "female";
    const torsoW = female ? 0.34 : 0.4;
    const mat = (color: string, metal = 0.22) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: metal, emissive: color, emissiveIntensity: 0.08 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(torsoW, 0.62, 5, 8), mat(suit, 0.38));
    torso.position.y = 1.12;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(skin, 0.08));
    head.position.y = 1.58;
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), mat(hair, 0.05));
    hairM.position.y = 1.66;
    hairM.scale.set(1, female ? 1.15 : 0.7, 1);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.08, 0.16),
      new THREE.MeshStandardMaterial({ color: "#04110d", emissive: op.visor, emissiveIntensity: 1.4 }),
    );
    visor.position.set(0, 1.6, 0.16);
    const mkLimb = (len: number, y: number, x: number) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, len, 4, 6), mat(suit));
      m.position.set(x, y, 0);
      return m;
    };
    const lArm = mkLimb(0.42, 1.18, -(torsoW + 0.12));
    const rArm = mkLimb(0.42, 1.18, torsoW + 0.12);
    const lLeg = mkLimb(0.5, 0.48, -0.12);
    const rLeg = mkLimb(0.5, 0.48, 0.12);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.12), mat("#161616", 0.5));
    pack.position.set(0, 1.15, -0.28);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 24),
      new THREE.MeshBasicMaterial({ color: this.teamHex(p), side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    pelvis.add(torso, head, hairM, visor, lArm, rArm, lLeg, rLeg, pack);
    root.add(pelvis, ring);
    return {
      root,
      pelvis,
      torso,
      head,
      visor,
      lArm,
      rArm,
      lLeg,
      rLeg,
      ring,
      char: (p.character || "") + (p.appearance?.outfit || ""),
      phase: 0,
    };
  }

  private makeCrate(kind: string): THREE.Group {
    const g = new THREE.Group();
    const color = (RARITY_COLOR as Record<string, string>)[kind] || (kind === "plates" ? "#7aa7ff" : "#3dffc0");
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({
        color: "#121821",
        emissive: color,
        emissiveIntensity: 0.35,
        metalness: 0.5,
        roughness: 0.4,
      }),
    );
    box.castShadow = true;
    g.add(box);
    return g;
  }
}
