"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Palette, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/format";
import type { CustomStyle } from "@/lib/types";

interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  section: string;
  sort: number;
}

export function CategoriesStylesManager() {
  const [activeTab, setActiveTab] = useState<"categories" | "styles">("categories");

  // Categories state
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [catEditingId, setCatEditingId] = useState<number | null>(null);
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catSection, setCatSection] = useState("magsafe-cases");
  const [catDesc, setCatDesc] = useState("");

  // Custom Styles & Materials state
  const [styles, setStyles] = useState<CustomStyle[]>([]);
  const [styleLoading, setStyleLoading] = useState(false);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [styleEditingId, setStyleEditingId] = useState<number | null>(null);
  const [styleName, setStyleName] = useState("");
  const [styleSlug, setStyleSlug] = useState("");
  const [styleSection, setStyleSection] = useState("magsafe-cases");
  const [styleHint, setStyleHint] = useState("");
  const [styleColor, setStyleColor] = useState("#1f2024");
  const [styleAccent, setStyleAccent] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadCategories = useCallback(() => {
    setCatLoading(true);
    api<{ data: CategoryRow[] }>("/admin/categories")
      .then((r) => setCategories(r.data))
      .finally(() => setCatLoading(false));
  }, []);

  const loadStyles = useCallback(() => {
    setStyleLoading(true);
    api<{ data: CustomStyle[] }>("/admin/custom-styles")
      .then((r) => setStyles(r.data))
      .finally(() => setStyleLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    api<{ data: CategoryRow[] }>("/admin/categories")
      .then((r) => {
        if (alive) setCategories(r.data);
      })
      .catch(() => {});
    api<{ data: CustomStyle[] }>("/admin/custom-styles")
      .then((r) => {
        if (alive) setStyles(r.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Category handlers
  const openCreateCat = () => {
    setCatEditingId(null);
    setCatName("");
    setCatSlug("");
    setCatSection("magsafe-cases");
    setCatDesc("");
    setErr(null);
    setShowCatModal(true);
  };

  const openEditCat = (c: CategoryRow) => {
    setCatEditingId(c.id);
    setCatName(c.name);
    setCatSlug(c.slug);
    setCatSection(c.section);
    setCatDesc(c.description || "");
    setErr(null);
    setShowCatModal(true);
  };

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return setErr("Category name is required");
    setSubmitting(true);
    setErr(null);
    try {
      if (catEditingId) {
        await api(`/admin/categories/${catEditingId}`, {
          method: "PATCH",
          json: { name: catName.trim(), description: catDesc.trim(), section: catSection },
        });
      } else {
        await api("/admin/categories", {
          method: "POST",
          json: { name: catName.trim(), slug: catSlug.trim() || undefined, description: catDesc.trim(), section: catSection },
        });
      }
      setShowCatModal(false);
      loadCategories();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCat = async (id: number, name: string) => {
    if (!confirm(`Delete category "${name}"? Products in this category may be affected.`)) return;
    try {
      await api(`/admin/categories/${id}`, { method: "DELETE" });
      loadCategories();
    } catch (e) {
      alert("Delete failed: " + (e as Error).message);
    }
  };

  // Custom Style handlers
  const openCreateStyle = () => {
    setStyleEditingId(null);
    setStyleName("");
    setStyleSlug("");
    setStyleSection("magsafe-cases");
    setStyleHint("");
    setStyleColor("#1f2024");
    setStyleAccent("");
    setErr(null);
    setShowStyleModal(true);
  };

  const openEditStyle = (s: CustomStyle) => {
    setStyleEditingId(s.id);
    setStyleName(s.name);
    setStyleSlug(s.slug);
    setStyleSection(s.section);
    setStyleHint(s.hint || "");
    setStyleColor(s.color);
    setStyleAccent(s.accent || "");
    setErr(null);
    setShowStyleModal(true);
  };

  const handleSaveStyle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!styleName.trim()) return setErr("Material name is required");
    setSubmitting(true);
    setErr(null);
    try {
      if (styleEditingId) {
        await api(`/admin/custom-styles/${styleEditingId}`, {
          method: "PATCH",
          json: { name: styleName.trim(), hint: styleHint.trim(), color: styleColor, accent: styleAccent.trim() || null },
        });
      } else {
        await api("/admin/custom-styles", {
          method: "POST",
          json: {
            name: styleName.trim(),
            slug: styleSlug.trim() || undefined,
            section: styleSection,
            hint: styleHint.trim(),
            color: styleColor,
            accent: styleAccent.trim() || null,
          },
        });
      }
      setShowStyleModal(false);
      loadStyles();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStyle = async (id: number, name: string) => {
    if (!confirm(`Delete style/material "${name}"?`)) return;
    try {
      await api(`/admin/custom-styles/${id}`, { method: "DELETE" });
      loadStyles();
    } catch (e) {
      alert("Delete failed: " + (e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* ───── Header Spotlight ───── */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-indigo-500/10 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                <Layers size={13} /> Categories, Styles &amp; Materials
              </span>
              <span className="text-xs text-muted">Complete Storefront Taxonomy Control</span>
            </div>
            <h3 className="text-xl font-extrabold text-ink mt-1">Categories &amp; 3D Material Styles Manager</h3>
            <p className="text-xs text-muted max-w-xl mt-1">
              Storefront ki tamam categories, 3D materials (jaise Alcantara, Titanium, Kevlar, Matte, Clear) aur types ko yahan manage karein.
              Aap bina kisi developer ke nayi category ya material add kar sakte hain.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={activeTab === "categories" ? openCreateCat : openCreateStyle}
              className="btn btn-primary flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-xs font-bold shadow-md"
            >
              <Plus size={16} /> {activeTab === "categories" ? "Add Category" : "Add Material / Style"}
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mt-4 flex gap-2 border-t border-purple-500/20 pt-3">
          <button
            onClick={() => setActiveTab("categories")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition",
              activeTab === "categories" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            <Layers size={14} /> Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab("styles")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition",
              activeTab === "styles" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            <Palette size={14} /> Custom 3D Materials &amp; Styles ({styles.length})
          </button>
        </div>
      </div>

      {/* ───── Categories View ───── */}
      {activeTab === "categories" && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-ink">Active Categories</h4>
            <button onClick={loadCategories} disabled={catLoading} className="grid h-7 w-7 place-items-center rounded-lg border border-black/10 hover:bg-black/5">
              <RefreshCw size={13} className={cn(catLoading && "animate-spin")} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-2.5">Category Name</th>
                  <th>Slug</th>
                  <th>Section</th>
                  <th>Description</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {categories.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-black/[0.015]">
                    <td className="py-3">
                      <b className="font-bold text-ink block">{c.name}</b>
                    </td>
                    <td>
                      <code className="text-[11.5px] text-muted rounded bg-black/[0.04] px-1.5 py-0.5">{c.slug}</code>
                    </td>
                    <td>
                      <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        {c.section}
                      </span>
                    </td>
                    <td className="text-xs text-muted max-w-xs truncate">{c.description || "—"}</td>
                    <td className="text-right space-x-1.5">
                      <button onClick={() => openEditCat(c)} className="chip text-[11px] hover:!bg-ink hover:!text-white">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteCat(c.id, c.name)} className="inline-grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger align-middle">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───── Custom Styles & Materials View ───── */}
      {activeTab === "styles" && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-ink">Custom 3D Materials &amp; Styles</h4>
              <p className="text-xs text-muted">Ye styles product banate waqt material options mein select kiye ja sakte hain.</p>
            </div>
            <button onClick={loadStyles} disabled={styleLoading} className="grid h-7 w-7 place-items-center rounded-lg border border-black/10 hover:bg-black/5">
              <RefreshCw size={13} className={cn(styleLoading && "animate-spin")} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-2.5">Material Name</th>
                  <th>Slug</th>
                  <th>Section</th>
                  <th>Hint</th>
                  <th>Color Preview</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {styles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-muted">
                      Abhi koi custom material add nahi kiya gaya. &ldquo;Add Material / Style&rdquo; button dabayein.
                    </td>
                  </tr>
                ) : (
                  styles.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-black/[0.015]">
                      <td className="py-3">
                        <b className="font-bold text-ink block">{s.name}</b>
                      </td>
                      <td>
                        <code className="text-[11.5px] text-muted rounded bg-black/[0.04] px-1.5 py-0.5">{s.slug}</code>
                      </td>
                      <td>
                        <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          {s.section}
                        </span>
                      </td>
                      <td className="text-xs text-muted">{s.hint || "—"}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="h-5 w-5 rounded-full border border-black/20" style={{ backgroundColor: s.color }} />
                          <span className="text-xs text-muted">{s.color}</span>
                        </div>
                      </td>
                      <td className="text-right space-x-1.5">
                        <button onClick={() => openEditStyle(s)} className="chip text-[11px] hover:!bg-ink hover:!text-white">
                          Edit
                        </button>
                        <button onClick={() => handleDeleteStyle(s.id, s.name)} className="inline-grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger align-middle">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───── Category Modal ───── */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-lg font-bold text-ink">{catEditingId ? "Edit Category" : "Add Category"}</h3>
              <button onClick={() => setShowCatModal(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/10">
                <X size={16} />
              </button>
            </div>
            {err && <div className="mt-3 rounded-xl bg-danger/10 p-2.5 text-xs text-danger font-medium">{err}</div>}
            <form onSubmit={handleSaveCat} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Tough Armor Cases, Leather Wallets"
                  className="input h-9 text-xs"
                />
              </div>
              {!catEditingId && (
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Slug (optional)</label>
                  <input
                    type="text"
                    value={catSlug}
                    onChange={(e) => setCatSlug(e.target.value)}
                    placeholder="e.g. tough-armor-cases"
                    className="input h-9 text-xs"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Storefront Section</label>
                <select value={catSection} onChange={(e) => setCatSection(e.target.value)} className="input h-9 text-xs">
                  <option value="magsafe-cases">MagSafe Cases</option>
                  <option value="skins">Skins</option>
                  <option value="screen-protectors">Screen Protectors</option>
                  <option value="gadgets">Gadgets &amp; Accessories</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Description (optional)</label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Short description for SEO and category page"
                  className="input h-auto py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setShowCatModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-xs font-bold">
                  {submitting ? "Saving..." : catEditingId ? "Save Changes" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───── Custom Style Modal ───── */}
      {showStyleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-lg font-bold text-ink">{styleEditingId ? "Edit Style / Material" : "Add Custom 3D Material"}</h3>
              <button onClick={() => setShowStyleModal(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/10">
                <X size={16} />
              </button>
            </div>
            {err && <div className="mt-3 rounded-xl bg-danger/10 p-2.5 text-xs text-danger font-medium">{err}</div>}
            <form onSubmit={handleSaveStyle} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Material Name *</label>
                <input
                  type="text"
                  required
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  placeholder="e.g. Alcantara Suede, Titanium Armor, Kevlar Weave"
                  className="input h-9 text-xs"
                />
              </div>
              {!styleEditingId && (
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Slug (optional)</label>
                  <input
                    type="text"
                    value={styleSlug}
                    onChange={(e) => setStyleSlug(e.target.value)}
                    placeholder="e.g. alcantara-suede, titanium-armor"
                    className="input h-9 text-xs"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Section</label>
                <select value={styleSection} onChange={(e) => setStyleSection(e.target.value)} className="input h-9 text-xs">
                  <option value="magsafe-cases">MagSafe Cases</option>
                  <option value="skins">Skins</option>
                  <option value="screen-protectors">Screen Protectors</option>
                  <option value="gadgets">Gadgets</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Hint / Tagline</label>
                <input
                  type="text"
                  value={styleHint}
                  onChange={(e) => setStyleHint(e.target.value)}
                  placeholder="e.g. Soft luxury grip, Aerospace grade strength"
                  className="input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Base Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={styleColor}
                    onChange={(e) => setStyleColor(e.target.value)}
                    className="h-9 w-9 rounded-lg border border-black/10 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={styleColor}
                    onChange={(e) => setStyleColor(e.target.value)}
                    className="input h-9 text-xs flex-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setShowStyleModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-xs font-bold">
                  {submitting ? "Saving..." : styleEditingId ? "Save Changes" : "Create Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
