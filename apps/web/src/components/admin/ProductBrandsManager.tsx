"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, ExternalLink, Globe, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/format";
import type { ProductBrand } from "@/lib/types";

export function ProductBrandsManager() {
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<{ data: ProductBrand[] }>("/admin/product-brands")
      .then((r) => setBrands(r.data))
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    api<{ data: ProductBrand[] }>("/admin/product-brands")
      .then((r) => {
        if (alive) setBrands(r.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setSlug("");
    setDescription("");
    setWebsite("");
    setActive(true);
    setErr(null);
    setShowModal(true);
  };

  const openEdit = (b: ProductBrand) => {
    setEditingId(b.id);
    setName(b.name);
    setSlug(b.slug);
    setDescription(b.description || "");
    setWebsite(b.website || "");
    setActive(b.active);
    setErr(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr("Brand name is required");
    setSubmitting(true);
    setErr(null);

    try {
      if (editingId) {
        await api(`/admin/product-brands/${editingId}`, {
          method: "PATCH",
          json: { name: name.trim(), description: description.trim(), website: website.trim() || null, active },
        });
      } else {
        await api("/admin/product-brands", {
          method: "POST",
          json: { name: name.trim(), slug: slug.trim() || undefined, description: description.trim(), website: website.trim() || null, active },
        });
      }
      setShowModal(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, bName: string) => {
    if (!confirm(`Are you sure you want to delete brand "${bName}"?`)) return;
    try {
      await api(`/admin/product-brands/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert("Delete failed: " + (e as Error).message);
    }
  };

  const handleToggle = async (id: number, currentActive: boolean) => {
    await api(`/admin/product-brands/${id}`, { method: "PATCH", json: { active: !currentActive } });
    load();
  };

  const filtered = brands.filter(
    (b) => b.name.toLowerCase().includes(search.toLowerCase()) || b.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* ───── Header Card ───── */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                <Building2 size={13} /> Product Brands &amp; Companies
              </span>
              <span className="text-xs text-muted">Vendors &amp; Manufacturers</span>
            </div>
            <h3 className="text-xl font-extrabold text-ink mt-1">Accessory Brands &amp; Companies Manager</h3>
            <p className="text-xs text-muted max-w-xl mt-1">
              Aap jin brands ka saman bechte hain (e.g. Casetify, dbrand, Ronin, Spigen, Apple, Samsung, Anker, Magora),
              unhe yahan create aur edit karein. Naya product banate waqt aap inme se brand select kar sakte hain.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="btn btn-primary flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-xs font-bold shadow-md"
          >
            <Plus size={16} /> Add Brand / Company
          </button>
        </div>
      </div>

      {/* ───── Main Table ───── */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-accent" />
            <h4 className="text-base font-bold text-ink">Registered Brands ({brands.length})</h4>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search brand name or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input h-8 w-64 text-xs"
            />
            <button
              onClick={load}
              disabled={loading}
              title="Refresh"
              className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 bg-white text-muted hover:text-ink"
            >
              <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2.5">Brand / Company</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Website</th>
                <th>Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((b) => (
                <tr key={b.id} className="transition-colors hover:bg-black/[0.015]">
                  <td className="py-3">
                    <b className="font-bold text-ink block">{b.name}</b>
                  </td>
                  <td>
                    <code className="text-[11.5px] text-muted rounded bg-black/[0.04] px-1.5 py-0.5">{b.slug}</code>
                  </td>
                  <td className="text-xs text-muted max-w-xs truncate">{b.description || "—"}</td>
                  <td>
                    {b.website ? (
                      <a
                        href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        <Globe size={12} /> Link <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={b.active}
                      onChange={() => handleToggle(b.id, b.active)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="text-right space-x-1.5">
                    <button
                      onClick={() => openEdit(b)}
                      className="chip text-[11px] hover:!bg-ink hover:!text-white transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(b.id, b.name)}
                      className="inline-grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger align-middle"
                      title="Delete brand"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───── Create / Edit Brand Modal ───── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  {editingId ? "Edit Brand / Company" : "Add Brand / Company"}
                </h3>
                <p className="text-xs text-muted">Brand ka naam aur tafseelat likhein.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/10">
                <X size={16} />
              </button>
            </div>

            {err && <div className="mt-3 rounded-xl bg-danger/10 p-2.5 text-xs text-danger font-medium">{err}</div>}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Brand Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Casetify, dbrand, Ronin, Spigen"
                  className="input h-9 text-xs"
                />
              </div>

              {!editingId && (
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Slug (optional)</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. casetify, dbrand"
                    className="input h-9 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Description (optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Premium impact cases & accessories"
                  className="input h-auto py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Website URL (optional)</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="input h-9 text-xs"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded"
                />
                <span>Active on store</span>
              </label>

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-xs font-bold">
                  {submitting ? "Saving..." : editingId ? "Save Changes" : "Create Brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
