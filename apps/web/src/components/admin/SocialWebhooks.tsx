"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Globe, Play, Share2, Sparkles, Webhook, Zap } from "lucide-react";
import { api } from "@/lib/client-api";

interface WebhookConfig {
  meta: {
    webhookUrl: string;
    verifyToken: string;
    totalOrders: number;
  };
  tiktok: {
    webhookUrl: string;
    verifyToken: string;
    totalOrders: number;
  };
  google: {
    webhookUrl: string;
    totalOrders: number;
  };
  universal: {
    webhookUrl: string;
  };
}

export function SocialWebhooks() {
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const loadConfig = () => {
    setLoading(true);
    api<{ data: WebhookConfig }>("/admin/social-webhooks/config")
      .then((res) => {
        setConfig(res.data);
      })
      .catch((err) => {
        console.error("Failed to load webhook config:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleTestOrder = async (source: "facebook_ad" | "tiktok_ad" | "google_ad") => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api<{ ok: boolean; data: { orderNumber: string; total: number; name: string }; message: string }>(
        "/admin/social-webhooks/test-order",
        {
          method: "POST",
          json: { source, model: "iPhone 18 Pro Max", color: "Crystal Clear" },
        },
      );
      setTestResult(`✅ ${res.message} (Customer: ${res.data.name})`);
      loadConfig();
    } catch (err: any) {
      setTestResult(`❌ Error creating test order: ${err?.message || err}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card relative overflow-hidden bg-gradient-to-r from-blue-900/10 via-purple-900/10 to-pink-900/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-bold text-blue-600">
              <Zap size={14} /> Zero-Friction Social Selling
            </span>
            <h2 className="text-xl font-bold tracking-tight">Social Ads Webhook Engine</h2>
            <p className="max-w-2xl text-sm text-muted">
              Connect your Meta (Facebook/Instagram), TikTok, and Google Lead Ads directly to Magora. When a customer submits an Instant Form on their social feed, an order is instantly created in your store without them ever leaving the app.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTestOrder("facebook_ad")}
              disabled={testing}
              className="btn btn-primary h-10 gap-1.5 text-xs shadow-sm"
            >
              <Play size={13} /> Test Facebook Order
            </button>
            <button
              onClick={() => handleTestOrder("tiktok_ad")}
              disabled={testing}
              className="btn bg-ink h-10 gap-1.5 text-xs text-white shadow-sm hover:opacity-90"
            >
              <Play size={13} /> Test TikTok Order
            </button>
          </div>
        </div>

        {testResult && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-white/80 p-3 text-xs font-semibold text-ink shadow-sm">
            {testResult}
          </div>
        )}
      </div>

      {/* Grid of Webhooks */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Meta (Facebook & Instagram) */}
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white font-black text-lg">
                f
              </div>
              <div>
                <h3 className="font-bold">Meta Lead Ads (Facebook & Instagram)</h3>
                <p className="text-xs text-muted">Automatic order creation from Meta Instant Forms</p>
              </div>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
              {config?.meta.totalOrders ?? 0} Orders
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-[11.5px] font-bold uppercase tracking-wider text-muted">Callback / Webhook URL</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-neutral-100 p-2 font-mono text-xs">
                <input
                  type="text"
                  readOnly
                  value={config?.meta.webhookUrl || "Loading..."}
                  className="flex-1 bg-transparent outline-none"
                />
                <button
                  onClick={() => config && copyToClipboard(config.meta.webhookUrl, "meta_url")}
                  className="chip h-7 px-2 text-xs"
                >
                  {copiedKey === "meta_url" ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11.5px] font-bold uppercase tracking-wider text-muted">Verify Token</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-neutral-100 p-2 font-mono text-xs">
                <input
                  type="text"
                  readOnly
                  value={config?.meta.verifyToken || "Loading..."}
                  className="flex-1 bg-transparent outline-none"
                />
                <button
                  onClick={() => config && copyToClipboard(config.meta.verifyToken, "meta_token")}
                  className="chip h-7 px-2 text-xs"
                >
                  {copiedKey === "meta_token" ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs leading-relaxed text-blue-900">
              <b>Setup Instructions:</b>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                <li>Go to <b>Meta Business Suite → Lead Access / Webhooks</b> (or your Meta Developer App).</li>
                <li>Add a Subscription for <b>Page → leadgen</b>.</li>
                <li>Paste the <b>Callback URL</b> and <b>Verify Token</b> above, then click <i>Verify and Save</i>.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* 2. TikTok Instant Forms */}
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-900 text-white font-bold text-sm">
                TikTok
              </div>
              <div>
                <h3 className="font-bold">TikTok Instant Forms Webhook</h3>
                <p className="text-xs text-muted">Instant orders from TikTok Lead Generation ads</p>
              </div>
            </div>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-800">
              {config?.tiktok.totalOrders ?? 0} Orders
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-[11.5px] font-bold uppercase tracking-wider text-muted">Webhook URL</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-neutral-100 p-2 font-mono text-xs">
                <input
                  type="text"
                  readOnly
                  value={config?.tiktok.webhookUrl || "Loading..."}
                  className="flex-1 bg-transparent outline-none"
                />
                <button
                  onClick={() => config && copyToClipboard(config.tiktok.webhookUrl, "tt_url")}
                  className="chip h-7 px-2 text-xs"
                >
                  {copiedKey === "tt_url" ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800">
              <b>Setup in TikTok Ads Manager:</b>
              <p className="mt-1">
                TikTok Ads Manager mein <b>Assets → Instant Page / Lead Generation → Webhooks</b> par jayein aur ye Webhook URL enter karein.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Universal Webhook (Zapier / Make / Pabbly / Custom Landing Pages) */}
        <div className="card space-y-4 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold">
                <Webhook size={18} />
              </div>
              <div>
                <h3 className="font-bold">Universal Ad Order Webhook (Zapier, Make, Pabbly, Custom APIs)</h3>
                <p className="text-xs text-muted">Use this JSON endpoint from any third-party marketing automation tool or custom funnel</p>
              </div>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
              POST JSON
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-[11.5px] font-bold uppercase tracking-wider text-muted">Endpoint URL</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-neutral-100 p-2 font-mono text-xs">
                <input
                  type="text"
                  readOnly
                  value={config?.universal.webhookUrl || "Loading..."}
                  className="flex-1 bg-transparent outline-none"
                />
                <button
                  onClick={() => config && copyToClipboard(config.universal.webhookUrl, "univ_url")}
                  className="chip h-7 px-2 text-xs"
                >
                  {copiedKey === "univ_url" ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11.5px] font-bold uppercase tracking-wider text-muted">Sample JSON Payload</label>
              <pre className="mt-1 max-h-36 overflow-auto rounded-xl bg-neutral-900 p-3 text-[11px] text-green-400">
{`{
  "source": "facebook_ad",
  "name": "Hamza Tariq",
  "phone": "03001234567",
  "city": "Lahore",
  "address": "House 14, Street 5, Gulberg III",
  "model": "iPhone 18 Pro Max",
  "color": "Crystal Clear"
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
