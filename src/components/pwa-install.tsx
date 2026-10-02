"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Modal } from "./travel-planner/form-ui";
import s from "./travel-planner/planner.module.css";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Watches standalone display mode without reading browser state during server rendering. */
function subscribeInstalled(update: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", update);
  window.addEventListener("appinstalled", update);
  return () => { media.removeEventListener("change", update); window.removeEventListener("appinstalled", update); };
}
/** Reads installed display mode on compatible browsers, including iOS standalone mode. */
function installedSnapshot() { return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone); }

/** Registers an offline-only worker and exposes browser-supported installation guidance. */
export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallEvent>();
  const [help, setHelp] = useState(false);
  const installed = useSyncExternalStore(subscribeInstalled, installedSnapshot, () => false);
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    }
    /** Retains the browser installation gesture until the user requests it. */
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const done = () => { setPrompt(undefined); setHelp(false); };
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", ready); window.removeEventListener("appinstalled", done); };
  }, []);
  /** Opens the native prompt where supported, otherwise explains home-screen installation. */
  async function install() {
    if (!prompt) { setHelp(true); return; }
    try { await prompt.prompt(); await prompt.userChoice; } finally { setPrompt(undefined); }
  }
  if (installed) return null;
  return <><button type="button" className={s.textButton} onClick={() => void install()}>Install RailWatch</button>{help && <Modal title="Install RailWatch" close={() => setHelp(false)}><div className={s.form}><p>Add RailWatch to your home screen to open it in its own app window.</p><p><b>iPhone or iPad:</b> Open in Safari, tap Share, then Add to Home Screen.</p><p><b>Android:</b> Open in Chrome and select Install app or Add to Home screen from its menu.</p><p className={s.help}>Installation needs HTTPS (or localhost for development). Journeys and tickets need a connection to your RailWatch server. This does not enable phone push notifications.</p></div></Modal>}</>;
}
