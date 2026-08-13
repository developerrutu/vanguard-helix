export type QualityId = "potato" | "low" | "medium" | "high" | "ultra";

export const QUALITY_LABEL: Record<QualityId, string> = {
  potato: "VERY LOW",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  ultra: "VERY HIGH",
};

export interface CapReport {
  webgl2: boolean;
  webgpu: boolean;
  gpu: string;
  cores: number;
  memoryGB: number;
  touch: boolean;
  gamepad: boolean;
  refreshHz: number;
  pixelRatio: number;
  mobile: boolean;
  android: boolean;
  ios: boolean;
  reducedMotion: boolean;
  ultrawide: boolean;
  recommended: QualityId;
}

export async function detectCapabilities(): Promise<CapReport> {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  let gpu = "unknown";
  if (gl) {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || gpu;
    else gpu = String(gl.getParameter(gl.RENDERER) || gpu);
  }

  let webgpu = false;
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    webgpu = Boolean(gpu && (await gpu.requestAdapter()));
  } catch {
    webgpu = false;
  }

  const ua = navigator.userAgent;
  const android = /Android/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  const mobile = android || ios || (touch && Math.min(screen.width, screen.height) < 820);
  const cores = navigator.hardwareConcurrency || 4;
  const memoryGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || (mobile ? 4 : 8);
  const pixelRatio = window.devicePixelRatio || 1;
  const ultrawide = window.innerWidth / Math.max(1, window.innerHeight) >= 2.0;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const refreshHz = await estimateRefresh();
  const gamepad = (navigator.getGamepads?.() || []).some(Boolean) || "ongamepadconnected" in window;

  const recommended = pickQuality({
    webgl2: Boolean(gl),
    gpu,
    cores,
    memoryGB,
    mobile,
    android,
    refreshHz,
    pixelRatio,
  });

  return {
    webgl2: Boolean(gl),
    webgpu,
    gpu,
    cores,
    memoryGB,
    touch,
    gamepad,
    refreshHz,
    pixelRatio,
    mobile,
    android,
    ios,
    reducedMotion,
    ultrawide,
    recommended,
  };
}

function pickQuality(p: {
  webgl2: boolean;
  gpu: string;
  cores: number;
  memoryGB: number;
  mobile: boolean;
  android: boolean;
  refreshHz: number;
  pixelRatio: number;
}): QualityId {
  if (!p.webgl2) return "potato";
  const g = p.gpu.toLowerCase();
  const weak =
    /mali-4|mali-t|adreno 3|adreno 4|adreno 5[0-3]|powervr|intel hd|intel uhd 6/.test(g) ||
    p.cores <= 4 ||
    p.memoryGB <= 3;
  if (p.mobile && weak) return "potato";
  if (p.android && (p.cores <= 6 || p.memoryGB <= 4)) return "low";
  if (p.mobile) return "medium";
  if (p.memoryGB >= 8 && p.cores >= 8 && p.refreshHz >= 90) return "ultra";
  if (p.memoryGB >= 8) return "high";
  return "medium";
}

async function estimateRefresh(): Promise<number> {
  if (typeof screen !== "undefined") {
    const s = screen as Screen & { refreshRate?: number };
    if (s.refreshRate && s.refreshRate > 0) return Math.round(s.refreshRate);
  }
  return new Promise((resolve) => {
    const samples: number[] = [];
    let last = 0;
    let frames = 0;
    const step = (t: number) => {
      if (last) samples.push(t - last);
      last = t;
      frames++;
      if (frames < 20) requestAnimationFrame(step);
      else {
        samples.sort((a, b) => a - b);
        const mid = samples[Math.floor(samples.length / 2)] || 16.67;
        const hz = Math.round(1000 / mid);
        const snapped = [30, 60, 75, 90, 120, 144, 165, 240].reduce((a, b) =>
          Math.abs(b - hz) < Math.abs(a - hz) ? b : a,
        );
        resolve(snapped);
      }
    };
    requestAnimationFrame(step);
  });
}

export interface QualityProfile {
  id: QualityId;
  pixelRatio: number;
  shadows: "off" | "cheap" | "mid" | "high";
  drawDistance: number;
  particles: number;
  antialias: boolean;
  post: boolean;
  grid: boolean;
}

export function profileFor(id: QualityId, caps: CapReport): QualityProfile {
  const native = Math.min(caps.pixelRatio, 3);
  const table: Record<QualityId, QualityProfile> = {
    potato: {
      id,
      pixelRatio: 1,
      shadows: "off",
      drawDistance: 40,
      particles: 0,
      antialias: false,
      post: false,
      grid: false,
    },
    low: {
      id,
      pixelRatio: 1,
      shadows: "off",
      drawDistance: 60,
      particles: 8,
      antialias: false,
      post: false,
      grid: true,
    },
    medium: {
      id,
      pixelRatio: Math.min(1.5, native),
      shadows: "cheap",
      drawDistance: 90,
      particles: 20,
      antialias: false,
      post: true,
      grid: true,
    },
    high: {
      id,
      pixelRatio: Math.min(2, native),
      shadows: "mid",
      drawDistance: 140,
      particles: 40,
      antialias: true,
      post: true,
      grid: true,
    },
    ultra: {
      id,
      pixelRatio: native,
      shadows: "high",
      drawDistance: 200,
      particles: 64,
      antialias: true,
      post: true,
      grid: true,
    },
  };
  return table[id];
}
