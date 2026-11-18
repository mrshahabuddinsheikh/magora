"use client";

import { useEffect, useState } from "react";
import { UserCheck, Shield, Users, UserPlus, Key, Mail, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/client-api";

interface StaffUser {
  id: number;
  email: string;
  name: string;
  role: "admin" | "operations" | "support" | "customer";
  createdAt: string;
}

export function StaffManager() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New staff form
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "operations" as "admin" | "operations" | "support",
  });

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await api<{ data: StaffUser[] }>("/admin/staff");
      if (res?.data) setStaff(res.data);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      await api("/admin/staff", {
        method: "POST",
        json: form,
      });
      setSuccessMsg(`✓ Staff member "${form.name}" added successfully!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setForm({ name: "", email: "", password: "", role: "operations" });
      setShowAddForm(false);
      await loadStaff();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to add staff member");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (id: number, newRole: string) => {
    try {
      await api(`/admin/staff/${id}`, {
        method: "PATCH",
        json: { role: newRole },
      });
      setSuccessMsg("✓ Staff permissions updated!");
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadStaff();
    } catch (e: any) {
      alert(e.message || "Failed to update role");
    }
  };

  if (loading) {
    return <div className="skeleton h-48 w-full rounded-2xl" />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
            <Users size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <span>Staff & Team Permissions</span>
              <span className="rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[10px] font-bold">
                {staff.length} Active Staff
              </span>
            </h3>
            <p className="text-xs text-muted">
              Role-based access: Admin (Full control), Operations (Orders desk, packing & shipping), Support (Customer assistance).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary h-9 px-3 text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <UserPlus size={14} />
          <span>{showAddForm ? "Cancel" : "Add Staff Member"}</span>
        </button>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-xs font-bold text-success flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger font-medium flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Add Staff Form */}
      {showAddForm && (
        <form onSubmit={handleAddStaff} className="card p-4 sm:p-5 border-2 border-accent/25 space-y-3 animate-in fade-in">
          <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
            <UserPlus size={15} className="text-accent" />
            <span>New Team Member Account</span>
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink">
              <span>Full Name</span>
              <input
                type="text"
                required
                placeholder="e.g. Ali Ahmed"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input h-10 w-full mt-1 text-xs"
              />
            </label>
            <label className="text-xs font-semibold text-ink">
              <span>Work Email</span>
              <input
                type="email"
                required
                placeholder="e.g. ali@magora.pk"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input h-10 w-full mt-1 text-xs font-mono"
              />
            </label>
            <label className="text-xs font-semibold text-ink">
              <span>Initial Password</span>
              <input
                type="password"
                required
                placeholder="Min 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input h-10 w-full mt-1 text-xs"
              />
            </label>
            <label className="text-xs font-semibold text-ink">
              <span>Role & Permission Level</span>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                className="input h-10 w-full mt-1 text-xs font-semibold"
              >
                <option value="operations">Operations / Warehouse (Desk, Packing, Courier Booking)</option>
                <option value="support">Customer Support (Orders & WhatsApp Lookup)</option>
                <option value="admin">Administrator (Full Access & Settings)</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-dark h-9 px-4 text-xs font-bold"
            >
              {saving ? "Creating..." : "Create Staff Account"}
            </button>
          </div>
        </form>
      )}

      {/* Staff Table */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-line">
          {staff.map((u) => (
            <div key={u.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-black/[0.01] transition">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-ink">{u.name}</span>
                  <span className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                    u.role === "admin"
                      ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                      : u.role === "operations"
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {u.role.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-muted flex items-center gap-2 mt-0.5 font-mono">
                  <span>{u.email}</span>
                  <span>·</span>
                  <span>Added {new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <select
                  value={u.role}
                  onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                  className="input h-8 text-xs font-medium"
                >
                  <option value="admin">Admin</option>
                  <option value="operations">Operations</option>
                  <option value="support">Support</option>
                  <option value="customer">Revoke (Customer)</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
