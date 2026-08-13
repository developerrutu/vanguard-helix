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

export function bindDisplayGates(opts: {
  rotateEl: HTMLElement;
  preferFullscreen: () => boolean;
}): () => void {
  const sync = () => {
    opts.rotateEl.classList.toggle("hidden", !isPortraitMobile());
  };
  sync();
  const onResize = () => sync();
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

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
