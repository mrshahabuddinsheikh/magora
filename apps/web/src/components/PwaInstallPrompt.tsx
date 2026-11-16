"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already in standalone PWA mode
    const navStandalone = Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
    if (window.matchMedia("(display-mode: standalone)").matches || navStandalone) {
      queueMicrotask(() => setIsStandalone(true));
      return;
    }

    // Check if user previously dismissed prompt within the last 3 days
    const dismissedAt = localStorage.getItem("mg_pwa_dismissed");
    if (dismissedAt && Date.now() - Number(dismissedAt) < 3 * 864e5) {
      return;
    }

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isIosDevice = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/.test(ua);
    if (isIosDevice) {
      queueMicrotask(() => setIsIos(true));
    }

    // Listen for Chromium beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Wait 3 seconds after page loads so the user explores first
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // If on iOS and not dismissed, show after 5 seconds
    if (isIosDevice) {
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("mg_pwa_dismissed", String(Date.now()));
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300 sm:bottom-6 sm:left-auto sm:right-6">
      <div className="glass relative rounded-[24px] border border-line bg-white/95 p-4 shadow-[0_20px_45px_-15px_rgba(15,23,42,0.35)] backdrop-blur-md">
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-black/5 hover:text-ink"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-ink to-slate-800 text-white shadow-md">
            <Smartphone size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                Fast App
              </span>
              <span className="text-[11px] text-muted">Offline &amp; Instant</span>
            </div>
            <h4 className="mt-0.5 text-sm font-bold text-ink">Install Magora App</h4>
            <p className="mt-0.5 text-xs text-muted leading-snug">
              Add Magora to your phone home screen for 1-tap order tracking, 3D viewer &amp; exclusive drop discounts.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-3.5 flex items-center gap-2 pt-2 border-t border-line/60">
          {isIos ? (
            <div className="flex w-full items-center justify-between text-xs text-ink/80 bg-black/[0.03] rounded-xl p-2.5">
              <span>
                Tap <Share size={13} className="inline mx-1 text-accent" /> then select <b>&quot;Add to Home Screen&quot;</b>
              </span>
              <button onClick={dismiss} className="font-semibold text-accent underline ml-2">
                Got it
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleInstallClick}
                className="btn btn-primary h-9 flex-1 text-xs font-semibold shadow-sm"
              >
                <Download size={14} /> Install Web App
              </button>
              <button
                onClick={dismiss}
                className="btn btn-glass h-9 px-3 text-xs text-muted hover:text-ink"
              >
                Not now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
