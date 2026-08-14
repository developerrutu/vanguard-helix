export function isPortraitMobile(): boolean {
  const coarse = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  return coarse && window.innerHeight > window.innerWidth;
}

export async function requestLandscape(): Promise<void> {
  try {
    const ori = screen.orientation as ScreenOrientation & {
      lock?: (m: string) => Promise<void>;
    };
    if (ori?.lock) await ori.lock("landscape");
  } catch {
    /* browsers may deny until installed PWA / fullscreen */
  }
}

export async function requestFullscreen(): Promise<void> {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  try {
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen();
      else el.webkitRequestFullscreen?.();
    }
  } catch {
    /* ignore */
  }
}

/** Call from a tap (Start / deploy). Android will not fullscreen without a gesture. */
export async function enterPlayDisplay(): Promise<void> {
  await requestFullscreen();
  await requestLandscape();
}

/** Pin the HUD/touch layer to the visual viewport so taps hit the buttons you see. */
export function fitOverlay(el: HTMLElement | null): void {
  if (!el) return;
  const vv = window.visualViewport;
  if (!vv) {
    el.style.inset = "0";
    el.style.width = "100%";
    el.style.height = "100%";
    return;
  }
  el.style.top = `${vv.offsetTop}px`;
  el.style.left = `${vv.offsetLeft}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.width = `${vv.width}px`;
  el.style.height = `${vv.height}px`;
}

export function bindDisplayGates(opts: {
  rotateEl: HTMLElement;
  preferFullscreen: () => boolean;
}): () => void {
  const sync = () => {
    opts.rotateEl.classList.toggle("hidden", !isPortraitMobile());
    fitOverlay(document.getElementById("touch"));
    fitOverlay(document.getElementById("hud"));
  };
  sync();
  const onResize = () => sync();
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("scroll", onResize);

  const onFirst = async () => {
    if (opts.preferFullscreen()) await requestFullscreen();
    await requestLandscape();
    sync();
  };
  window.addEventListener("pointerdown", onFirst, { once: true });
  return () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
  };
}
