"use client";

import { useEffect, useState } from "react";
import { 
  Share2, Save, CheckCircle2, AlertCircle, RefreshCw, 
  Search, ShieldCheck, Flame, ExternalLink, HelpCircle
} from "lucide-react";
import { api } from "@/lib/client-api";
import type { MarketingSettings } from "@/lib/types";

export function MarketingPixelsManager() {
  const [data, setData] = useState<MarketingSettings>({
    id: 1,
    enabled: true,
    metaPixelId: "",
    tiktokPixelId: "",
    googleTagId: "",
    googleAdsConversionId: "",
    googleSearchConsoleCode: "",
    pinterestTagId: "",
    snapchatPixelId: "",
    trackPurchases: true,
    trackAddToCart: true,
    trackInitiateCheckout: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: MarketingSettings }>("/marketing-settings", { auth: false });
      if (res?.data) {
        setData({
          ...res.data,
          metaPixelId: res.data.metaPixelId ?? "",
          tiktokPixelId: res.data.tiktokPixelId ?? "",
          googleTagId: res.data.googleTagId ?? "",
          googleAdsConversionId: res.data.googleAdsConversionId ?? "",
          googleSearchConsoleCode: res.data.googleSearchConsoleCode ?? "",
          pinterestTagId: res.data.pinterestTagId ?? "",
          snapchatPixelId: res.data.snapchatPixelId ?? "",
        });
      }
    } catch (e: any) {
      setError(e.message || "Failed to load marketing settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const res = await api<{ data: MarketingSettings }>("/admin/marketing-settings", {
        method: "POST",
        json: data,
      });
      if (res?.data) {
        setData((prev) => ({ ...prev, ...res.data }));
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      }
    } catch (e: any) {
      setError(e.message || "Failed to update marketing settings");
    } finally {
      setSaving(false);
    }
  };

  const testPixels = () => {
    const events: string[] = [];
    const w = window as any;

    if (w.fbq) {
      try {
        w.fbq("track", "PageView");
        events.push("✓ Meta Pixel: PageView triggered");
      } catch (err: any) {
        events.push("✗ Meta Pixel error: " + err.message);
      }
    } else {
      events.push("ℹ Meta Pixel script not loaded yet (or no Pixel ID configured)");
    }

    if (w.ttq) {
      try {
        w.ttq.page();
        events.push("✓ TikTok Pixel: PageView triggered");
      } catch (err: any) {
        events.push("✗ TikTok Pixel error: " + err.message);
      }
    } else {
      events.push("ℹ TikTok Pixel script not loaded yet (or no Pixel ID configured)");
    }

    if (w.gtag) {
      try {
        w.gtag("event", "page_view");
        events.push("✓ Google Tag (GA4/Ads): page_view triggered");
      } catch (err: any) {
        events.push("✗ Google Tag error: " + err.message);
      }
    } else {
      events.push("ℹ Google Tag not loaded yet (or no Tag ID configured)");
    }

    setTestResult(events.join("\n"));
  };

  if (loading) {
    return <div className="skeleton h-96 w-full rounded-[28px]" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Share2 size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-ink tracking-tight flex items-center gap-2">
                <span>Marketing & Ad Pixels Hub</span>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                  data.enabled ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500" : "bg-zinc-500/10 text-muted"
                }`}>
                  {data.enabled ? "Active & Tracking" : "Disabled"}
                </span>
              </h2>
              <p className="text-xs text-muted">
                Meta (Facebook/Instagram) Pixel, TikTok Ads Pixel, Google Ads / GA4 & Google Search Console verification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={testPixels}
            className="btn btn-secondary text-xs h-9 inline-flex items-center gap-1.5"
            title="Fire a test event to check in Meta/TikTok browser helpers"
          >
            <Flame size={14} className="text-amber-500" />
            <span>Test Pixels</span>
          </button>
          <button
            type="button"
            onClick={loadSettings}
            className="btn btn-secondary text-xs h-9 inline-flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {savedSuccess && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>Marketing pixels & SEO settings saved successfully! Storefront will sync instantly.</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-danger/10 border border-danger/20 p-4 flex items-center gap-3 text-danger text-xs font-semibold">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {testResult && (
        <div className="rounded-2xl bg-zinc-900 text-zinc-100 p-4 text-xs font-mono whitespace-pre-line space-y-1">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-800 font-sans text-zinc-400">
            <span>Pixel Diagnostics Test:</span>
            <button onClick={() => setTestResult(null)} className="text-[11px] hover:text-white">Clear</button>
          </div>
          {testResult}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Master Tracking Switch */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-ink">Master Marketing Pixels Status</h3>
              <p className="text-xs text-muted">
                Turn all ad tracking pixels (Meta, TikTok, Google) ON or OFF across the website with a single switch.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={data.enabled}
                onChange={(e) => setData({ ...data, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
            </label>
          </div>
        </div>

        {/* 1. Meta / Facebook Pixel */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-line">
            <span className="text-xl">🔵</span>
            <div>
              <h3 className="text-base font-bold text-ink">Meta Pixel (Facebook & Instagram Ads)</h3>
              <p className="text-xs text-muted">
                Tracks PageView, ViewContent, AddToCart, InitiateCheckout and Purchase for your Facebook & Instagram campaigns.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-ink flex items-center justify-between">
                <span>Meta Pixel ID</span>
                <a 
                  href="https://adsmanager.facebook.com/events_manager2" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-1"
                >
                  <span>Find your ID in Meta Events Manager</span>
                  <ExternalLink size={11} />
                </a>
              </label>
              <input
                type="text"
                placeholder="e.g. 1827461928374619"
                value={data.metaPixelId ?? ""}
                onChange={(e) => setData({ ...data, metaPixelId: e.target.value })}
                className="input h-10 w-full text-xs font-mono"
              />
              <p className="text-[11px] text-muted">
                15-16 digit numeric ID from your Meta Business account.
              </p>
            </div>
          </div>
        </div>

        {/* 2. TikTok Pixel */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-line">
            <span className="text-xl">🎵</span>
            <div>
              <h3 className="text-base font-bold text-ink">TikTok Pixel (TikTok Ads Manager)</h3>
              <p className="text-xs text-muted">
                Syncs product views, add to bag, and completed orders with TikTok Ads for Pakistan and global audience targeting.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-ink flex items-center justify-between">
                <span>TikTok Pixel ID / Code</span>
                <a 
                  href="https://ads.tiktok.com/marketing_api/docs" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-1"
                >
                  <span>TikTok Ads Manager</span>
                  <ExternalLink size={11} />
                </a>
              </label>
              <input
                type="text"
                placeholder="e.g. C8ABCDEF1234567890"
                value={data.tiktokPixelId ?? ""}
                onChange={(e) => setData({ ...data, tiktokPixelId: e.target.value })}
                className="input h-10 w-full text-xs font-mono"
              />
              <p className="text-[11px] text-muted">
                Pixel code starting with C or similar alphanumeric format from TikTok Ads Assets ➔ Events.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Google Ads, GA4 & Search Console */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-line">
            <span className="text-xl">🔴</span>
            <div>
              <h3 className="text-base font-bold text-ink">Google Ads, Analytics & Search Console (SEO)</h3>
              <p className="text-xs text-muted">
                Verify domain ownership on Google Search Console in seconds and track Google Ads conversions.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-ink">Google Tag / GA4 ID (G-XXXXX or AW-XXXXX)</label>
              <input
                type="text"
                placeholder="e.g. G-ABC123XYZ or AW-987654321"
                value={data.googleTagId ?? ""}
                onChange={(e) => setData({ ...data, googleTagId: e.target.value })}
                className="input h-10 w-full text-xs font-mono"
              />
              <p className="text-[11px] text-muted">Used for Google Analytics 4 and global site tracking.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-ink">Google Ads Conversion ID & Label</label>
              <input
                type="text"
                placeholder="e.g. AW-987654321/AbCdEfGhIjK"
                value={data.googleAdsConversionId ?? ""}
                onChange={(e) => setData({ ...data, googleAdsConversionId: e.target.value })}
                className="input h-10 w-full text-xs font-mono"
              />
              <p className="text-[11px] text-muted">Fires on order completion with exact PKR revenue.</p>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-ink flex items-center justify-between">
                <span>Google Search Console Verification Tag (SEO)</span>
                <a 
                  href="https://search.google.com/search-console" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-1"
                >
                  <span>Google Search Console</span>
                  <ExternalLink size={11} />
                </a>
              </label>
              <input
                type="text"
                placeholder="e.g. 7AbcD1234EfGhIjkLmNoPqRsTuVwXyZ0123456789 (or full <meta name='google-site-verification'...>)"
                value={data.googleSearchConsoleCode ?? ""}
                onChange={(e) => setData({ ...data, googleSearchConsoleCode: e.target.value })}
                className="input h-10 w-full text-xs font-mono"
              />
              <p className="text-[11px] text-muted">
                Paste your verification code or HTML tag here. It will be added to your website header automatically so Google verifies your site instantly.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Automated E-commerce Event Triggers */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-line">
            <ShieldCheck size={18} className="text-accent" />
            <h3 className="text-base font-bold text-ink">E-Commerce Standard Events Dispatcher</h3>
          </div>
          <p className="text-xs text-muted">
            The store automatically sends rich event data (product ID, name, currency PKR, quantity, and value) to all active pixels:
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="card p-3.5 flex items-center gap-3 cursor-pointer border border-line hover:border-accent transition">
              <input
                type="checkbox"
                checked={data.trackAddToCart}
                onChange={(e) => setData({ ...data, trackAddToCart: e.target.checked })}
                className="rounded accent-accent h-4 w-4"
              />
              <div className="text-xs">
                <p className="font-bold text-ink">Add to Cart</p>
                <p className="text-[10.5px] text-muted">Fires on item added to bag</p>
              </div>
            </label>

            <label className="card p-3.5 flex items-center gap-3 cursor-pointer border border-line hover:border-accent transition">
              <input
                type="checkbox"
                checked={data.trackInitiateCheckout}
                onChange={(e) => setData({ ...data, trackInitiateCheckout: e.target.checked })}
                className="rounded accent-accent h-4 w-4"
              />
              <div className="text-xs">
                <p className="font-bold text-ink">Initiate Checkout</p>
                <p className="text-[10.5px] text-muted">Fires when checkout opens</p>
              </div>
            </label>

            <label className="card p-3.5 flex items-center gap-3 cursor-pointer border border-line hover:border-accent transition">
              <input
                type="checkbox"
                checked={data.trackPurchases}
                onChange={(e) => setData({ ...data, trackPurchases: e.target.checked })}
                className="rounded accent-accent h-4 w-4"
              />
              <div className="text-xs">
                <p className="font-bold text-ink">Purchase (Orders)</p>
                <p className="text-[10.5px] text-muted">Fires on order place with PKR total</p>
              </div>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary h-11 px-8 text-xs font-bold inline-flex items-center gap-2 shadow-lg"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? "Saving Pixels..." : "Save Marketing Pixels"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
