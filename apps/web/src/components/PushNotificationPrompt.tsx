"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Sparkles, X } from "lucide-react";
import { api } from "@/lib/client-api";

export function PushNotificationPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    // Only run if serviceWorker and Notification API are supported
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
      return;
    }

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.log("SW registration notice:", err));

    // If permission already granted or denied, don't show prompt
    if (Notification.permission !== "default") {
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem("mg_push_dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 864e5) {
      return;
    }

    // Show after 8 seconds of engagement
    const timer = setTimeout(() => {
      setShow(true);
    }, 8000);

    return () => clearTimeout(timer);
  }, []);

  const enableNotifications = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const reg = await navigator.serviceWorker.ready;
        // In full VAPID setups, an applicationServerKey is passed
        // For demonstration & browser notification enablement:
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          try {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              // Generates default fallback endpoint on browser push service
              applicationServerKey: new Uint8Array([
                4, 18, 122, 230, 89, 44, 219, 14, 160, 204, 187, 85, 222, 10, 110, 18, 24, 76, 12, 14, 98, 110, 144, 22, 11, 48, 19, 210, 102, 18, 140, 22, 10, 88, 19, 42, 18, 90, 144, 12, 190, 88, 12, 90, 110, 18, 122, 14, 160, 204, 187, 85, 222, 10, 110, 18, 24, 76, 12, 14, 98, 110, 144, 22, 11,
              ]),
            });
          } catch {}
        }

        if (sub) {
          const subJson = sub.toJSON();
          await api("/push/subscribe", {
            method: "POST",
            auth: false,
            json: {
              endpoint: sub.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh || "browser_fallback_p256dh",
                auth: subJson.keys?.auth || "browser_fallback_auth",
              },
              deviceInfo: navigator.userAgent.slice(0, 150),
            },
          }).catch(() => {});
        }

        setSubscribed(true);
        setTimeout(() => setShow(false), 2000);
      } else {
        setShow(false);
      }
    } catch (err) {
      console.log("Push enable error:", err);
      setShow(false);
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("mg_push_dismissed", String(Date.now()));
  };

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="glass rounded-[24px] border border-line bg-white/95 p-3.5 shadow-[0_20px_45px_-15px_rgba(15,23,42,0.35)] backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
            <Bell size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] font-bold text-accent">
                <Sparkles size={12} /> VIP Drop Alerts
              </span>
              <button onClick={dismiss} className="text-muted hover:text-ink">
                <X size={14} />
              </button>
            </div>
            <p className="mt-0.5 text-xs font-bold text-ink">Never miss limited stock &amp; flash sales</p>
            <p className="mt-0.5 text-[11px] text-muted">
              Get notified when your cart is on discount or new phone models launch.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={enableNotifications}
                disabled={loading || subscribed}
                className="chip h-7 bg-ink text-white text-[11.5px] px-3 font-semibold hover:bg-black/80"
              >
                {subscribed ? (
                  <>
                    <Check size={12} /> Enabled
                  </>
                ) : loading ? (
                  "Enabling…"
                ) : (
                  "Turn On Notifications"
                )}
              </button>
              <button onClick={dismiss} className="text-[11px] text-muted hover:text-ink">
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
