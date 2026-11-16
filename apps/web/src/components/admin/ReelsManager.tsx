"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { 
  Plus, Trash2, Heart, MessageCircle, Video, 
  ExternalLink, RefreshCw, Eye, EyeOff, Upload
} from "lucide-react";
import { api } from "@/lib/client-api";
import { money } from "@/lib/format";
import { ShoppableReel, getYouTubeId } from "@/components/reels/ShoppableReelModal";
import { PUBLIC_API_URL } from "@/lib/config";

interface ProductOption {
  id: number;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  images?: string[];
}

export function ReelsManager() {
  const [reels, setReels] = useState<ShoppableReel[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [likesCount, setLikesCount] = useState("24800");
  const [commentsCount, setCommentsCount] = useState("85");
  const [phoneModel, setPhoneModel] = useState("iPhone 16 Pro Max");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reelsRes, productsRes] = await Promise.all([
        api<{ data: ShoppableReel[] }>("/admin/reels"),
        api<{ data: ProductOption[] }>("/products?limit=60"),
      ]);
      setReels(reelsRes.data || []);
      setProducts(productsRes.data || []);
    } catch (err: unknown) {
      console.error("Failed to load admin reels data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(loadData);
  }, []);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${PUBLIC_API_URL}/api/v1/uploads/video`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.data?.url) {
        setVideoUrl(data.data.url);
      } else {
        alert("Video upload failed. Please try a smaller MP4 clip or paste a video URL.");
      }
    } catch {
      alert("Video upload error. Please paste a video URL directly.");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleCreateReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !videoUrl.trim()) {
      alert("Please enter title and video URL");
      return;
    }

    setSubmitting(true);
    try {
      const selectedProduct = products.find((p) => p.id === Number(selectedProductId));

      await api("/admin/reels", {
        method: "POST",
        json: {
          title: title.trim(),
          caption: caption.trim() || undefined,
          videoUrl: videoUrl.trim(),
          thumbnailUrl: thumbnailUrl.trim() || (selectedProduct?.images?.[0] ?? undefined),
          productId: selectedProduct?.id,
          productName: selectedProduct?.name,
          productPrice: selectedProduct?.price,
          productCompareAtPrice: selectedProduct?.compareAtPrice,
          productSlug: selectedProduct?.slug,
          productImage: selectedProduct?.images?.[0],
          phoneModel,
          likesCount: Number(likesCount) || 18500,
          commentsCount: Number(commentsCount) || 45,
          active: true,
        },
      });

      setShowAddModal(false);
      setTitle("");
      setCaption("");
      setVideoUrl("");
      setThumbnailUrl("");
      setSelectedProductId("");
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create reel";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleReelStatus = async (reel: ShoppableReel) => {
    try {
      await api(`/admin/reels/${reel.id}`, {
        method: "PUT",
        json: { active: !reel.active },
      });
      loadData();
    } catch {
      alert("Failed to update status");
    }
  };

  const deleteReel = async (id: number) => {
    if (!confirm("Are you sure you want to delete this reel?")) return;
    try {
      await api(`/admin/reels/${id}`, { method: "DELETE" });
      loadData();
    } catch {
      alert("Failed to delete reel");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
                <Video size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">TikTok & Instagram Shoppable Reels</h2>
                <p className="text-xs text-muted">
                  Add 9:16 vertical video reels with buy-now buttons, simulated 20k+ likes, and 5-star customer reviews.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="btn btn-secondary text-xs h-9"
              title="Refresh Reels"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary text-xs h-9 bg-rose-600 hover:bg-rose-500 text-white"
            >
              <Plus size={14} />
              <span>Add New Reel Clip</span>
            </button>
          </div>
        </div>

        {/* Reels Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line text-muted uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Video / Reel</th>
                <th className="py-2.5 px-3">Attached Product</th>
                <th className="py-2.5 px-3">Social Proof</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reels.map((reel) => (
                <tr key={reel.id} className="hover:bg-neutral-50/5 transition">
                  {/* Video & Title */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-10 rounded-lg overflow-hidden bg-neutral-900 border border-line shrink-0">
                        {reel.thumbnailUrl ? (
                          <Image
                            src={reel.thumbnailUrl}
                            alt={reel.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted">
                            <Video size={16} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 max-w-[280px]">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-ink truncate">{reel.title}</p>
                          {getYouTubeId(reel.videoUrl) && (
                            <span className="shrink-0 rounded bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.2 text-[9px] font-black text-rose-500 uppercase">
                              YouTube
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted truncate">{reel.caption || "No caption"}</p>
                        <a
                          href={reel.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-accent inline-flex items-center gap-0.5 mt-0.5"
                        >
                          <span>Video Link</span>
                          <ExternalLink size={9} />
                        </a>
                      </div>
                    </div>
                  </td>

                  {/* Attached Product */}
                  <td className="py-3 px-3">
                    {reel.productName ? (
                      <div>
                        <span className="font-bold text-ink block">{reel.productName}</span>
                        <span className="text-emerald-500 font-semibold">{money(reel.productPrice || 0)}</span>
                        {reel.phoneModel && <span className="text-[10px] text-muted block">{reel.phoneModel}</span>}
                      </div>
                    ) : (
                      <span className="text-muted italic">No attached product</span>
                    )}
                  </td>

                  {/* Social Proof metrics */}
                  <td className="py-3 px-3">
                    <div className="space-y-1">
                      <span className="flex items-center gap-1 font-semibold text-rose-500">
                        <Heart size={12} className="fill-rose-500" />
                        {reel.likesCount.toLocaleString()} Likes
                      </span>
                      <span className="flex items-center gap-1 text-muted text-[11px]">
                        <MessageCircle size={12} />
                        {reel.comments?.length || reel.commentsCount} Reviews
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    <button
                      onClick={() => toggleReelStatus(reel)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        reel.active
                          ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                          : "bg-neutral-500/10 text-neutral-400 hover:bg-neutral-500/20"
                      }`}
                    >
                      {reel.active ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{reel.active ? "Active" : "Disabled"}</span>
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => deleteReel(reel.id)}
                      className="p-1.5 text-muted hover:text-rose-500 transition rounded-lg hover:bg-rose-500/10"
                      title="Delete Reel"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {reels.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    No shoppable reels created yet. Click &quot;Add New Reel Clip&quot; above to add your first TikTok video!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Reel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Video size={18} className="text-rose-500" />
                <h3 className="font-bold text-ink">Add Shoppable TikTok / Instagram Reel</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-muted hover:text-ink">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReel} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Reel Title *</label>
                <input
                  type="text"
                  placeholder="e.g. iPhone 16 Pro Max Drop Test on Concrete"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Caption / Description</label>
                <textarea
                  placeholder="Short description, hashtags, key features..."
                  rows={2}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="input w-full"
                />
              </div>

              {/* Video URL or Upload */}
              <div>
                <label className="font-bold text-ink block mb-1">
                  Video Source (MP4, WebM, or YouTube Short link) *
                </label>
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="https://.../video.mp4 or https://youtube.com/shorts/..."
                    required
                    value={videoUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVideoUrl(val);
                      const yt = getYouTubeId(val);
                      if (yt && !thumbnailUrl) {
                        setThumbnailUrl(`https://img.youtube.com/vi/${yt}/hqdefault.jpg`);
                      }
                    }}
                    className="input w-full"
                  />
                  {getYouTubeId(videoUrl) && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold">
                      <Video size={14} className="shrink-0" />
                      <span>YouTube Short detected! All YouTube outer branding, titles & buttons will be seamlessly hidden in TikTok 9:16 layout.</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="btn btn-secondary text-xs cursor-pointer inline-flex items-center gap-1.5 h-8">
                      <Upload size={14} />
                      <span>{uploadingVideo ? "Uploading Video..." : "Upload MP4 Clip"}</span>
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        onChange={handleVideoUpload}
                        className="hidden"
                        disabled={uploadingVideo}
                      />
                    </label>
                    <span className="text-[11px] text-muted">Or upload max 60 MB vertical MP4</span>
                  </div>
                </div>
              </div>

              {/* Attach Product */}
              <div>
                <label className="font-bold text-ink block mb-1">Attach Shoppable Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : "")}
                  className="input w-full"
                >
                  <option value="">-- Choose Product to Buy Now --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({money(p.price)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Likes & Reviews simulation */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-ink block mb-1">Simulated Likes</label>
                  <input
                    type="number"
                    value={likesCount}
                    onChange={(e) => setLikesCount(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Simulated Reviews</label>
                  <input
                    type="number"
                    value={commentsCount}
                    onChange={(e) => setCommentsCount(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Phone Model</label>
                  <input
                    type="text"
                    value={phoneModel}
                    onChange={(e) => setPhoneModel(e.target.value)}
                    className="input w-full"
                    placeholder="e.g. iPhone 16 Pro Max"
                  />
                </div>
              </div>

              <div className="border-t border-line pt-3 flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs bg-rose-600 hover:bg-rose-500 text-white"
                >
                  {submitting ? "Publishing Reel..." : "Publish Shoppable Reel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
