export function registerPwa(): { promptInstall: () => Promise<void>; canInstall: () => boolean } {
  let deferred: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as unknown as typeof deferred;
    document.getElementById("btn-install")?.classList.remove("hidden");
  });

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }

  return {
    canInstall: () => Boolean(deferred),
    async promptInstall() {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      document.getElementById("btn-install")?.classList.add("hidden");
    },
  };
}
