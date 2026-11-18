"use client";

import { useEffect, useState, useRef } from "react";
import { 
  Database, Download, Upload, RefreshCw, ShieldCheck, 
  AlertTriangle, CheckCircle2, Clock, HardDrive, FileCode,
  Package, ShoppingBag, Users, Phone, Video,
  ArrowDownToLine, History, RotateCcw
} from "lucide-react";
import { api } from "@/lib/client-api";
import { PUBLIC_API_URL } from "@/lib/config";

interface DbInfo {
  databaseFile: string;
  size: string;
  sizeBytes: number;
  walSize: string;
  lastModified: string;
  counts: {
    orders: number;
    products: number;
    variants: number;
    customers: number;
    leads: number;
    reels: number;
    reviews: number;
    returns: number;
    coupons: number;
  };
  serverBackups: Array<{
    name: string;
    size: string;
    sizeBytes: number;
    createdAt: string;
  }>;
}

export function DatabaseBackupManager() {
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingDb, setDownloadingDb] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  
  // Restore state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadInfo = async () => {
    setLoading(true);
    try {
      const res = await api<{ data: DbInfo }>("/admin/database/info");
      if (res.data) setInfo(res.data);
    } catch (err) {
      console.error("Failed to load database info:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(loadInfo);
  }, []);

  const handleDownloadDb = async () => {
    setDownloadingDb(true);
    try {
      const token = localStorage.getItem("mg_token");
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/admin/database/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Download request failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `magora-database-backup-${stamp}.db`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download database backup. Please try again.");
    } finally {
      setDownloadingDb(false);
    }
  };

  const handleDownloadJson = async () => {
    setDownloadingJson(true);
    try {
      const token = localStorage.getItem("mg_token");
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/admin/database/download-json`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("JSON export request failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `magora-database-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export JSON backup.");
    } finally {
      setDownloadingJson(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    try {
      const res = await api<{ data: { success: boolean; name: string } }>("/admin/database/create-snapshot", {
        method: "POST",
      });
      if (res.data?.success) {
        await loadInfo();
        alert(`Server snapshot created: ${res.data.name}`);
      }
    } catch {
      alert("Could not create server snapshot.");
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setRestoreSuccess(null);
      setRestoreError(null);
    }
  };

  const executeRestore = async () => {
    if (!selectedFile) return;
    setRestoring(true);
    setRestoreSuccess(null);
    setRestoreError(null);
    setShowConfirmModal(false);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const token = localStorage.getItem("mg_token");
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/admin/database/restore`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Restore failed.");
      }

      setRestoreSuccess(
        `Database restored successfully! Auto-rollback snapshot saved as '${json.data?.rollbackBackupCreated}'.`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadInfo();
    } catch (err: unknown) {
      setRestoreError(err instanceof Error ? err.message : "Failed to restore database");
    } finally {
      setRestoring(false);
    }
  };

  const handleRestoreSnapshot = async (snapshotName: string) => {
    if (!confirm(`Are you sure you want to restore from '${snapshotName}'? Current database will be snapshotted before replacing.`)) {
      return;
    }

    setRestoring(true);
    setRestoreSuccess(null);
    setRestoreError(null);
    try {
      const res = await api<{ data: { success: boolean; message: string } }>("/admin/database/restore-snapshot", {
        method: "POST",
        json: { snapshotName },
      });
      if (res.data?.success) {
        setRestoreSuccess(res.data.message);
        await loadInfo();
      }
    } catch (err: unknown) {
      setRestoreError(err instanceof Error ? err.message : "Snapshot restore failed.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
              <Database size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-ink tracking-tight flex items-center gap-2">
                <span>Database Backup & Restore</span>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10.5px] font-bold text-emerald-500">
                  MySQL 8 / InnoDB Active
                </span>
              </h2>
              <p className="text-xs text-muted">
                1-Click complete database backup, export and restore system with automatic rollback protection.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadInfo}
          disabled={loading}
          className="btn btn-secondary text-xs h-9 self-start sm:self-auto inline-flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Success / Error Alerts */}
      {restoreSuccess && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-600 dark:text-emerald-400 flex items-start gap-3 text-sm font-semibold animate-in fade-in">
          <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Restore Complete!</p>
            <p className="text-xs text-emerald-600/90 dark:text-emerald-300">{restoreSuccess}</p>
          </div>
        </div>
      )}

      {restoreError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-600 dark:text-rose-400 flex items-start gap-3 text-sm font-semibold animate-in fade-in">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Restore Failed</p>
            <p className="text-xs text-rose-600/90 dark:text-rose-300">{restoreError}</p>
          </div>
        </div>
      )}

      {/* Live Database Stats Card */}
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <HardDrive size={24} className="text-accent" />
            <div>
              <p className="text-sm font-bold text-ink">Active Database File</p>
              <p className="text-xs text-muted">store.db · WAL Enabled</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="rounded-lg bg-black/[0.04] dark:bg-white/10 px-3 py-1.5">
              <span className="text-muted mr-1.5">DB Size:</span>
              <span className="text-ink font-bold">{info?.size || "Loading..."}</span>
            </div>
            {info && info.walSize !== "0 B" && (
              <div className="rounded-lg bg-black/[0.04] dark:bg-white/10 px-3 py-1.5">
                <span className="text-muted mr-1.5">WAL Cache:</span>
                <span className="text-ink font-bold">{info.walSize}</span>
              </div>
            )}
            <div className="hidden md:flex items-center gap-1 text-muted">
              <Clock size={13} />
              <span>Last Modified: {info?.lastModified ? new Date(info.lastModified).toLocaleTimeString() : "--"}</span>
            </div>
          </div>
        </div>

        {/* Record Counters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-line p-3 bg-black/[0.02] dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-xs font-medium text-muted mb-1">
              <Package size={14} className="text-accent" />
              <span>Orders</span>
            </div>
            <p className="text-lg font-black text-ink">{info?.counts.orders.toLocaleString() ?? 0}</p>
          </div>

          <div className="rounded-xl border border-line p-3 bg-black/[0.02] dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-xs font-medium text-muted mb-1">
              <ShoppingBag size={14} className="text-emerald-500" />
              <span>Products</span>
            </div>
            <p className="text-lg font-black text-ink">{info?.counts.products.toLocaleString() ?? 0}</p>
          </div>

          <div className="rounded-xl border border-line p-3 bg-black/[0.02] dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-xs font-medium text-muted mb-1">
              <Phone size={14} className="text-emerald-600" />
              <span>Leads (CRM)</span>
            </div>
            <p className="text-lg font-black text-ink">{info?.counts.leads.toLocaleString() ?? 0}</p>
          </div>

          <div className="rounded-xl border border-line p-3 bg-black/[0.02] dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-xs font-medium text-muted mb-1">
              <Video size={14} className="text-rose-500" />
              <span>Shoppable Reels</span>
            </div>
            <p className="text-lg font-black text-ink">{info?.counts.reels.toLocaleString() ?? 0}</p>
          </div>

          <div className="rounded-xl border border-line p-3 bg-black/[0.02] dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-xs font-medium text-muted mb-1">
              <Users size={14} className="text-amber-500" />
              <span>Customers</span>
            </div>
            <p className="text-lg font-black text-ink">{info?.counts.customers.toLocaleString() ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Two Column Section: 1-Click Download & Restore Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Box 1: 1-Click Backup & Download */}
        <div className="card p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 px-2.5 py-0.5 text-xs font-bold text-accent">
              <Download size={13} />
              <span>Export & Backup</span>
            </div>
            <h3 className="text-lg font-black text-ink">1-Click Full Backup Download</h3>
            <p className="text-xs text-muted leading-relaxed">
              Ek single click se apna mukammal database file download karein. Isme orders, products, customers, leads, reels aur settings ka exact bit-for-bit backup shamil hota hai.
            </p>
          </div>

          <div className="space-y-3">
            {/* Primary MySQL .sql Download */}
            <button
              onClick={handleDownloadDb}
              disabled={downloadingDb}
              className="btn btn-primary w-full text-xs font-bold h-12 shadow-md inline-flex items-center justify-center gap-2"
            >
              <ArrowDownToLine size={18} className={downloadingDb ? "animate-bounce" : ""} />
              <span>{downloadingDb ? "Generating MySQL SQL Dump..." : "Download Full MySQL Dump (.sql)"}</span>
            </button>

            {/* Secondary JSON Export Download */}
            <button
              onClick={handleDownloadJson}
              disabled={downloadingJson}
              className="btn btn-secondary w-full text-xs font-bold h-10 inline-flex items-center justify-center gap-2"
            >
              <FileCode size={16} />
              <span>{downloadingJson ? "Exporting JSON..." : "Download JSON Data Export (.json)"}</span>
            </button>

            <button
              onClick={handleCreateSnapshot}
              disabled={creatingSnapshot}
              className="w-full text-center text-[11px] font-semibold text-accent hover:underline py-1"
            >
              {creatingSnapshot ? "Saving snapshot on server..." : "+ Save Instant MySQL Snapshot to Server Backups"}
            </button>
          </div>
        </div>

        {/* Box 2: Restore Database from File */}
        <div className="card p-5 sm:p-6 flex flex-col justify-between space-y-5 border-2 border-line">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-500">
              <Upload size={13} />
              <span>Data Restoration</span>
            </div>
            <h3 className="text-lg font-black text-ink">Restore Database from Backup</h3>
            <p className="text-xs text-muted leading-relaxed">
              Apna pehle se download kiya hua MySQL (.sql) dump ya JSON export yahan upload karke data wapas restore karein.
            </p>
          </div>

          <div className="space-y-3">
            {/* File Upload Box */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer border-2 border-dashed border-line hover:border-accent rounded-2xl p-4 text-center transition bg-black/[0.02] dark:bg-white/[0.02] space-y-2"
            >
              <Upload size={24} className="mx-auto text-muted" />
              <div className="text-xs">
                {selectedFile ? (
                  <p className="font-bold text-ink">
                    Selected: <span className="text-accent">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                ) : (
                  <>
                    <p className="font-bold text-ink">Click to select .sql or .json backup file</p>
                    <p className="text-[11px] text-muted">Supports MySQL SQL Dump (.sql) or JSON export</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.json,.db"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Warning Note */}
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-2">
              <ShieldCheck size={16} className="shrink-0 mt-0.5" />
              <span>
                <b>Auto-Rollback Protection:</b> Restore karne se pehle system mojooda database ka ek automatic safety backup banata hai, taake koi data kabhi zaya na ho.
              </span>
            </div>

            {/* Restore Trigger Button */}
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={!selectedFile || restoring}
              className="btn btn-primary bg-amber-600 hover:bg-amber-500 text-white w-full text-xs font-bold h-12 disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} className={restoring ? "animate-spin" : ""} />
              <span>{restoring ? "Restoring Database..." : "Restore Database from Uploaded File"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Server Snapshots History */}
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={18} className="text-muted" />
            <h3 className="font-bold text-ink text-sm sm:text-base">Server Backups History ({info?.serverBackups.length || 0})</h3>
          </div>
          <span className="text-[11px] text-muted">Stored securely in ./backups</span>
        </div>

        {info?.serverBackups && info.serverBackups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2.5 px-3">Backup File</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Created Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {info.serverBackups.map((bk) => (
                  <tr key={bk.name} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 font-semibold text-ink flex items-center gap-2">
                      <Database size={14} className="text-accent" />
                      <span>{bk.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-muted">{bk.size}</td>
                    <td className="py-2.5 px-3 text-muted">
                      {new Date(bk.createdAt).toLocaleDateString()} {new Date(bk.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleRestoreSnapshot(bk.name)}
                        disabled={restoring}
                        className="btn btn-secondary h-7 px-2.5 text-[11px] font-semibold hover:border-amber-500 hover:text-amber-500"
                        title="Restore this server backup"
                      >
                        Restore This
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-muted text-xs">
            No server snapshots found yet. Click &quot;Save Instant Snapshot to Server Backups&quot; above to create one.
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="card max-w-md w-full p-6 space-y-4 bg-white dark:bg-neutral-900 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle size={28} />
              <h4 className="text-lg font-black text-ink">Confirm Database Restore</h4>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Kya aap waqai <b className="text-ink">{selectedFile?.name}</b> se database restore karna chahte hain? 
              Mojooda database ka ek automatic safety backup banaya jayega taake aap chahein toh wapas purane data par bhi ja sakein.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="btn btn-secondary text-xs h-9 px-4"
              >
                Cancel
              </button>
              <button
                onClick={executeRestore}
                className="btn btn-primary bg-amber-600 hover:bg-amber-500 text-white text-xs h-9 px-4 font-bold"
              >
                Yes, Restore Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
