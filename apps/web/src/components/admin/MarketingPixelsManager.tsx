"use client";

import { useEffect, useState } from "react";
import { 
  Share2, Save, CheckCircle2, AlertCircle, RefreshCw, 
  Search, ShieldCheck, Flame, ExternalLink, HelpCircle,
  Copy, Check, Zap, Rss, Lock
} from "lucide-react";
import { api } from "@/lib/client-api";
import { SITE_URL } from "@/lib/config";
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
    metaCapiToken: "",
    metaTestEventCode: "",
    tiktokAccessToken: "",
    tiktokTestEventCode: "",
    trackPurchases: true,
    trackAddToCart: true,
    trackInitiateCheckout: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingCapi, setTestingCapi] = useState(false);
  const [feedCopied, setFeedCopied] = useState(false);

  const feedUrl = `${typeof window !== "undefined" ? window.location.origin : SITE_URL}/feed.xml`;

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: MarketingSettings }>("/admin/marketing-settings");
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
          metaCapiToken: res.data.metaCapiToken ?? "",
          metaTestEventCode: res.data.metaTestEventCode ?? "",
          tiktokAccessToken: res.data.tiktokAccessToken ?? "",
          tiktokTestEventCode: res.data.tiktokTestEventCode ?? "",
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
        events.push("✓ Meta Browser Pixel: PageView triggered");
      } catch (err: any) {
        events.push("✗ Meta Browser Pixel error: " + err.message);
      }
    } else {
      events.push("ℹ Meta Browser Pixel script not loaded yet (or no Pixel ID configured)");
    }

    if (w.ttq) {
      try {
        w.ttq.page();
        events.push("✓ TikTok Browser Pixel: PageView triggered");
      } catch (err: any) {
        events.push("✗ TikTok Browser Pixel error: " + err.message);
      }
    } else {
      events.push("ℹ TikTok Browser Pixel script not loaded yet (or no Pixel ID configured)");
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

  const testServerCapi = async () => {
    setTestingCapi(true);
    setTestResult(null);
    try {
      const res = await api<{ success: boolean; testOrder: any; results: any }>("/admin/marketing/test-capi", {
        method: "POST",
      });
      const lines: string[] = [
        `=== Server-Side CAPI Dispatch Test for Order #${res.testOrder.number} ===`,
      ];
      if (res.results?.meta) {
        lines.push(`Meta CAPI: ${res.results.meta.ok ? "✓ SUCCESS (HTTP " + res.results.meta.status + ")" : "✗ " + JSON.stringify(res.results.meta)}`);
      }
      if (res.results?.tiktok) {
        lines.push(`TikTok Events API: ${res.results.tiktok.ok ? "✓ SUCCESS (HTTP " + res.results.tiktok.status + ")" : "✗ " + JSON.stringify(res.results.tiktok)}`);
      }
      setTestResult(lines.join("\n"));
    } catch (e: any) {
      setTestResult(`✗ Server CAPI Test Failed: ${e.message}`);
    } finally {
      setTestingCapi(false);
    }
  };

  const copyFeedUrl = async () => {
    await navigator.clipboard.writeText(feedUrl);
    setFeedCopied(true);
    setTimeout(() => setFeedCopied(false), 2000);
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
                Meta Conversions API (CAPI), TikTok Events API, Google Ads / GA4 & Google Search Console verification.
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
            <span>Browser Pixel Test</span>
          </button>
          <button
            type="button"
            disabled={testingCapi}
            onClick={testServerCapi}
            className="btn btn-secondary text-xs h-9 inline-flex items-center gap-1.5 font-bold"
            title="Send test purchase event directly from backend to Meta and TikTok CAPI"
          >
            <Zap size={14} className="text-accent" />
            <span>{testingCapi ? "Testing CAPI..." : "⚡ Test Server CAPI"}</span>
          </button>
        </div>
      </div>

      {testResult && (
        <div className="rounded-2xl border border-line bg-black/[0.03] dark:bg-white/[0.04] p-4 text-xs font-mono whitespace-pre-wrap animate-in fade-in">
          <div className="font-bold text-ink mb-1 flex items-center justify-between">
            <span>Diagnostics Output</span>
            <button onClick={() => setTestResult(null)} className="text-muted hover:text-ink">Close ✕</button>
          </div>
          {testResult}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-xs text-danger font-medium flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>✓ Marketing pixels and Conversions API settings saved successfully!</span>
        </div>
      )}

      {/* ── Dynamic Product Catalog Feed (Google & Meta) ── */}
      <div className="rounded-3xl border border-accent/20 bg-gradient-to-r from-accent/5 via-accent/10 to-transparent p-5 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white font-bold">
              <Rss size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <span>Dynamic Ad Catalog Feed (Google Merchant & Meta)</span>
                <span className="rounded-full bg-accent/20 text-accent px-2 py-0.5 text-[10px] font-bold">LIVE XML</span>
              </h3>
              <p className="text-xs text-muted">
                Automatically syncs all products, prices, images, stock, and descriptions with Meta Catalog Ads & Google Shopping.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={copyFeedUrl}
            className="btn btn-secondary h-9 px-3 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            {feedCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            <span>{feedCopied ? "Copied Feed URL!" : "Copy Feed URL"}</span>
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white/80 dark:bg-black/40 p-2.5 border border-line text-xs font-mono text-ink overflow-x-auto">
          <span className="text-muted shrink-0">URL:</span>
          <a href={feedUrl} target="_blank" rel="noreferrer" className="text-accent underline truncate flex-1">
            {feedUrl}
          </a>
          <a href={feedUrl} target="_blank" rel="noreferrer" className="text-muted hover:text-ink shrink-0">
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Global Master Switch */}
        <div className="card p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <label htmlFor="marketing-enabled" className="text-sm font-bold text-ink cursor-pointer">
              Enable Ad Tracking & Pixels
            </label>
            <p className="text-xs text-muted">
              Master toggle to activate or silence all client-side and server-side tracking tags instantly.
            </p>
          </div>
          <input
            id="marketing-enabled"
            type="checkbox"
            checked={data.enabled}
            onChange={(e) => setData({ ...data, enabled: e.target.checked })}
            className="h-5 w-5 rounded border-line text-accent focus:ring-accent cursor-pointer"
          />
        </div>

        {/* 1. Meta (Facebook & Instagram) Pixel + Conversions API (CAPI) */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-line">
            <span className="text-xl">🔵</span>
            <div>
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <span>Meta (Facebook & Instagram) Pixel & Server CAPI</span>
                <span className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[10px] font-bold">Recommended</span>
              </h3>
              <p className="text-xs text-muted">
                Tracks PageView, ViewContent, AddToCart, InitiateCheckout & Server-Side Purchase via Conversions API (bypassing ad blockers & iOS 14+ restrictions).
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

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-ink flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock size={12} className="text-accent" />
                  <span>Meta Conversions API (CAPI) Access Token</span>
                </span>
                <span className="text-[11px] text-muted font-normal">Events Manager ➔ Settings ➔ Generate access token</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. EAAB..."
                value={data.metaCapiToken ?? ""}
                onChange={(e) => setData({ ...data, metaCapiToken: e.target.value })}
                className="input py-2 w-full text-xs font-mono"
              />
              <p className="text-[11px] text-muted">
                Direct server-to-server tracking token. Har order backend se direct Facebook ko dispatch ho ga.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-ink">Meta Test Event Code (Optional)</label>
              <input
                type="text"
                placeholder="e.g. TEST12345"
                value={data.metaTestEventCode ?? ""}
                onChange={(e) => setData({ ...data, metaTestEventCode: e.target.value })}
                className="input h-10 w-full text-xs font-mono"
              />
              <p className="text-[11px] text-muted">Testing ke doran Meta Events Manager &ldquo;Test Events&rdquo; tab se milta hai.</p>
            </div>
          </div>
        </div>

        {/* 2. TikTok Pixel & Events API */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-line">
            <span className="text-xl">🎵</span>
            <div>
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <span>TikTok Pixel & Events API</span>
                <span className="rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 px-2 py-0.5 text-[10px] font-bold">Hybrid</span>
              </h3>
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
                Pixel code starting with C or alphanumeric format from TikTok Ads Assets ➔ Events.
              </p>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-ink flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock size={12} className="text-accent" />
                  <span>TikTok Events API Access Token</span>
                </span>
                <span className="text-[11px] text-muted font-normal">TikTok Ads Manager ➔ Events ➔ Web Events ➔ Settings</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. 7a8b9c..."
                value={data.tiktokAccessToken ?? ""}
                onChange={(e) => setData({ ...data, tiktokAccessToken: e.target.value })}
                className="input py-2 w-full text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-ink">TikTok Test Event Code (Optional)</label>
              <input
                type="text"
                placeholder="e.g. TEST1234"
                value={data.tiktokTestEventCode ?? ""}
                onChange={(e) => setData({ ...data, tiktokTestEventCode: e.target.value })}
                className="input h-10 w-full text-xs font-mono"
              />
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
                placeholder='e.g. google-site-verification=abc123xyz OR just the string'
                value={data.googleSearchConsoleCode ?? ""}
                onChange={(e) => setData({ ...data, googleSearchConsoleCode: e.target.value })}
                className="input h-10 w-full text-xs font-mono"
              />
              <p className="text-[11px] text-muted">
                Copy the content attribute from HTML Tag verification method on Google Search Console. Automatically injected into website &lt;head&gt;.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Tracking Event Preferences */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="pb-3 border-b border-line">
            <h3 className="text-base font-bold text-ink">Conversion Tracking Events</h3>
            <p className="text-xs text-muted">Choose which high-intent shopping events should report to your ad accounts.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-3 p-3 rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer hover:border-accent/50 transition">
              <input
                type="checkbox"
                checked={data.trackPurchases}
                onChange={(e) => setData({ ...data, trackPurchases: e.target.checked })}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              <div>
                <b className="text-xs text-ink block">Purchases</b>
                <span className="text-[11px] text-muted">Fires on order placement</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer hover:border-accent/50 transition">
              <input
                type="checkbox"
                checked={data.trackAddToCart}
                onChange={(e) => setData({ ...data, trackAddToCart: e.target.checked })}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              <div>
                <b className="text-xs text-ink block">Add To Bag</b>
                <span className="text-[11px] text-muted">Fires on adding case/skin</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer hover:border-accent/50 transition">
              <input
                type="checkbox"
                checked={data.trackInitiateCheckout}
                onChange={(e) => setData({ ...data, trackInitiateCheckout: e.target.checked })}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              <div>
                <b className="text-xs text-ink block">Initiate Checkout</b>
                <span className="text-[11px] text-muted">Fires when opening checkout</span>
              </div>
            </label>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary h-11 px-6 text-sm font-bold inline-flex items-center gap-2"
          >
            {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{saving ? "Saving Pixels..." : "Save Marketing Configuration"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
