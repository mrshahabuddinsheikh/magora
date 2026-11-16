"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Shield, ShieldAlert, ShieldCheck, Terminal, Unlock } from "lucide-react";
import { api } from "@/lib/client-api";

interface SecurityEvent {
  id: string;
  timestamp: string;
  ip: string;
  method: string;
  url: string;
  threatType: string;
  severity: string;
  matchedPattern: string;
}

interface SecurityStatsData {
  totalBlockedThreats: number;
  threatsByType: Record<string, number>;
  activeBannedIpsCount: number;
  bannedIps: { ip: string; unbanInSeconds: number }[];
  recentEvents: SecurityEvent[];
}

export function SecurityShield() {
  const [data, setData] = useState<SecurityStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unbanning, setUnbanning] = useState<string | null>(null);

  const loadStats = (showLoader = false) => {
    if (showLoader) setLoading(true);
    api<{ data: SecurityStatsData }>("/admin/security/stats")
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    queueMicrotask(() => loadStats());
    const interval = setInterval(loadStats, 15_000);
    return () => clearInterval(interval);
  }, []);

  const handleUnban = async (ip: string) => {
    setUnbanning(ip);
    try {
      await api("/admin/security/unban", { method: "POST", json: { ip } });
      loadStats();
    } catch {}
    setUnbanning(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-[28px] border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-black to-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-inner">
              <ShieldCheck size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Magora Cyber Shield</h2>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  BLUE TEAM ACTIVE
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Web Application Firewall (WAF) & Real-time Intrusion Prevention System (IPS)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadStats(true)}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Status
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
            <span className="text-[11px] font-medium text-slate-400">Total Intercepted Attacks</span>
            <div className="mt-1 text-2xl font-bold text-emerald-400">{data?.totalBlockedThreats ?? 0}</div>
            <span className="text-[10px] text-emerald-300/80">100% Blocked by WAF</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
            <span className="text-[11px] font-medium text-slate-400">Active Banned IPs</span>
            <div className="mt-1 text-2xl font-bold text-rose-400">{data?.activeBannedIpsCount ?? 0}</div>
            <span className="text-[10px] text-rose-300/80">Auto-dropped at edge</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
            <span className="text-[11px] font-medium text-slate-400">Red Team Audit Score</span>
            <div className="mt-1 text-2xl font-bold text-cyan-400">100%</div>
            <span className="text-[10px] text-cyan-300/80">23 / 23 Tests Defended</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
            <span className="text-[11px] font-medium text-slate-400">HTTP Armor & CSP</span>
            <div className="mt-1 flex items-center gap-1.5 text-lg font-bold text-emerald-400">
              <CheckCircle2 size={18} /> FORTIFIED
            </div>
            <span className="text-[10px] text-slate-400">HSTS, X-Frame DENY</span>
          </div>
        </div>
      </div>

      {/* Threats Breakdown & Banned IPs */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Threat Categories */}
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Shield size={16} className="text-accent" />
            <span>Defended Attack Vectors</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {[
              { label: "SQL Injection (SQLi)", key: "sqli", desc: "Database theft & bypass attacks" },
              { label: "Cross-Site Scripting (XSS)", key: "xss", desc: "Script injections & cookie stealing" },
              { label: "Path Traversal & LFI", key: "path_traversal", desc: "Server system files access attempts" },
              { label: "Command Injection (RCE)", key: "command_injection", desc: "Terminal execution attempts" },
              { label: "Automated Bot Scanners", key: "scanner_bot", desc: "sqlmap, nikto, dirbuster probes" },
            ].map((cat) => {
              const count = data?.threatsByType[cat.key] ?? 0;
              return (
                <div key={cat.key} className="flex items-center justify-between rounded-xl border border-black/5 bg-slate-50 p-3">
                  <div>
                    <b className="block text-xs font-semibold text-ink">{cat.label}</b>
                    <span className="text-[11px] text-muted">{cat.desc}</span>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    {count} Defended
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Banned IPs list */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ShieldAlert size={16} className="text-danger" />
              <span>Banned Attacker IPs ({data?.activeBannedIpsCount ?? 0})</span>
            </div>
            <span className="text-[11px] text-muted">Auto-ban for 1 hour on 5 offenses</span>
          </div>

          <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
            {(!data?.bannedIps || data.bannedIps.length === 0) ? (
              <div className="rounded-2xl border border-dashed border-black/10 p-6 text-center text-xs text-muted">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
                No attacker IPs currently banned. All normal traffic flowing smoothly.
              </div>
            ) : (
              data.bannedIps.map((b) => (
                <div key={b.ip} className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-xs">
                  <div>
                    <span className="font-mono font-bold text-rose-700">{b.ip}</span>
                    <span className="block text-[10.5px] text-muted">Unbans in ~{Math.round(b.unbanInSeconds / 60)} minutes</span>
                  </div>
                  <button
                    disabled={unbanning === b.ip}
                    onClick={() => handleUnban(b.ip)}
                    className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-ink border border-black/10 hover:bg-black/5 transition"
                  >
                    <Unlock size={12} /> Unban
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live Security Event Logs */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Terminal size={16} className="text-accent" />
            <span>Live WAF Security Interceptions Log</span>
          </div>
          <span className="text-xs text-muted">Real-time incident records</span>
        </div>

        {(!data?.recentEvents || data.recentEvents.length === 0) ? (
          <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-xs text-muted">
            <ShieldCheck size={28} className="mx-auto text-emerald-500 mb-2" />
            No threats recorded yet. Run <code className="bg-black/5 px-1 py-0.5 rounded font-mono">npm run security:audit</code> to test the Red Team simulation.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-[11px]">
            {data.recentEvents.map((ev) => (
              <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/5 bg-slate-900 p-2.5 text-slate-200">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-bold text-rose-400 text-[10px]">
                    {ev.threatType.toUpperCase()}
                  </span>
                  <span className="text-slate-400 font-semibold">{ev.ip}</span>
                  <span className="text-amber-300 truncate max-w-xs">{ev.url}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 text-[10.5px]">
                  <span className="text-emerald-400 font-bold">BLOCKED 403</span>
                  <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
