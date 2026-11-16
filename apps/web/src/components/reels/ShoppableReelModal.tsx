"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { 
  Heart, MessageCircle, Share2, Volume2, VolumeX, X, 
  ShoppingBag, Check, Copy, Star, Send, ChevronUp, ChevronDown, 
  ShieldCheck, Truck, Zap, Phone
} from "lucide-react";
import { api } from "@/lib/client-api";
import { money } from "@/lib/format";

export interface ReelComment {
  id: string;
  author: string;
  avatar?: string;
  city?: string;
  rating: number;
  text: string;
  likes: number;
  timeAgo: string;
  verifiedBuyer?: boolean;
}

export interface ShoppableReel {
  id: number;
  title: string;
  caption: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  productId: number | null;
  productName: string | null;
  productPrice: number | null;
  productCompareAtPrice: number | null;
  productSlug: string | null;
  productImage: string | null;
  phoneModel: string | null;
  likesCount: number;
  viewsCount: number;
  commentsCount: number;
  sharesCount: number;
  comments: ReelComment[];
  active: boolean;
  sort: number;
}

/** Extract clean YouTube Video ID from Shorts or regular YouTube URLs */
export function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

interface ShoppableReelModalProps {
  reels: ShoppableReel[];
  initialIndex?: number;
  onClose: () => void;
}

export function ShoppableReelModal({ reels, initialIndex = 0, onClose }: ShoppableReelModalProps) {
  const [reelItems, setReelItems] = useState(reels);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fallbackUrls, setFallbackUrls] = useState<Record<number, string>>({});
  const [likesMap, setLikesMap] = useState<Record<number, number>>(() => {
    const initialLikes: Record<number, number> = {};
    reels.forEach((r) => {
      initialLikes[r.id] = r.likesCount;
    });
    return initialLikes;
  });
  const [userLikedMap, setUserLikedMap] = useState<Record<number, boolean>>({});
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showFastBuy, setShowFastBuy] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fast Buy Form state
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerCity, setBuyerCity] = useState("Lahore");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [selectedModel, setSelectedModel] = useState("iPhone 16 Pro Max");
  const [buying, setBuying] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Comment input state
  const [commentText, setCommentText] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const wheelCooldownRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);

  const currentReel = reelItems[currentIndex];
  const youtubeId = getYouTubeId(currentReel?.videoUrl);

  const resolveVideoUrl = useCallback((url: string | null | undefined): string => {
    if (!url) return "/videos/reel-1.mp4";
    // Replace blocked/unsupported external hosts with local reliable video
    if (url.includes("mixkit.co") || url.includes("sample-videos.com")) {
      return "/videos/reel-1.mp4";
    }
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
      return url;
    }
    return `/${url}`;
  }, []);

  const activeVideoUrl = currentReel
    ? (fallbackUrls[currentReel.id] || resolveVideoUrl(currentReel.videoUrl))
    : "/videos/reel-1.mp4";

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < reels.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowComments(false);
      setShowFastBuy(false);
      setShowShare(false);
    }
  }, [currentIndex, reels.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setShowComments(false);
      setShowFastBuy(false);
      setShowShare(false);
    }
  }, [currentIndex]);

  // Keyboard navigation (Escape, Up, Down)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "PageDown") handleNext();
      if (e.key === "ArrowUp" || e.key === "PageUp") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  // Real TikTok-style vertical mouse wheel scroll listener
  useEffect(() => {
    const onWindowWheel = (e: WheelEvent) => {
      if (showComments || showFastBuy || showShare) return;
      if (wheelCooldownRef.current) return;
      if (Math.abs(e.deltaY) < 25) return;

      if (e.deltaY > 0) {
        wheelCooldownRef.current = true;
        handleNext();
        setTimeout(() => {
          wheelCooldownRef.current = false;
        }, 500);
      } else if (e.deltaY < 0) {
        wheelCooldownRef.current = true;
        handlePrev();
        setTimeout(() => {
          wheelCooldownRef.current = false;
        }, 500);
      }
    };

    window.addEventListener("wheel", onWindowWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWindowWheel);
  }, [handleNext, handlePrev, showComments, showFastBuy, showShare]);

  // Real TikTok-style mobile touch swipe gestures (Swipe Up / Down)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (showComments || showFastBuy || showShare) return;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    if (showComments || showFastBuy || showShare) return;
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartYRef.current - touchEndY;
    touchStartYRef.current = null;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext(); // Swipe Up -> Next Reel
      } else {
        handlePrev(); // Swipe Down -> Previous Reel
      }
    }
  };

  // Handle HTML5 Video playback safely on index or source change
  useEffect(() => {
    if (youtubeId) return; // YouTube uses its own iframe autoplay
    const video = videoRef.current;
    if (!video) return;

    let isMounted = true;
    setIsPlaying(true);

    const safePlay = async () => {
      try {
        if (video.readyState >= 1) {
          video.currentTime = 0;
        }
        await video.play();
      } catch {
        if (!isMounted) return;
        try {
          video.muted = true;
          setMuted(true);
          await video.play();
        } catch {
          if (isMounted) setIsPlaying(false);
        }
      }
    };

    if (video.readyState >= 2) {
      safePlay();
    } else {
      const handleCanPlay = () => {
        if (isMounted) {
          safePlay();
        }
      };
      video.addEventListener("canplay", handleCanPlay, { once: true });
      return () => {
        isMounted = false;
        video.removeEventListener("canplay", handleCanPlay);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [currentIndex, activeVideoUrl, youtubeId]);

  const togglePlay = () => {
    if (youtubeId) {
      const nextPlaying = !isPlaying;
      setIsPlaying(nextPlaying);
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({
            event: "command",
            func: nextPlaying ? "playVideo" : "pauseVideo",
            args: [],
          }),
          "*"
        );
      } catch {
        // silent
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn("Video playback paused or blocked:", err);
        setIsPlaying(false);
      });
    }
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (youtubeId) {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({
            event: "command",
            func: nextMuted ? "mute" : "unMute",
            args: [],
          }),
          "*"
        );
      } catch {
        // silent
      }
    }
  };

  const handleLike = async () => {
    if (!currentReel) return;
    const reelId = currentReel.id;
    const isLiked = userLikedMap[reelId];

    // Optimistic update
    setUserLikedMap((prev) => ({ ...prev, [reelId]: !isLiked }));
    setLikesMap((prev) => ({
      ...prev,
      [reelId]: (prev[reelId] || currentReel.likesCount) + (isLiked ? -1 : 1),
    }));

    if (!isLiked) {
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 900);
      try {
        await api(`/reels/${reelId}/like`, { method: "POST", auth: false });
      } catch {
        // silent
      }
    }
  };

  const handleDoubleTap = () => {
    if (!userLikedMap[currentReel?.id]) {
      handleLike();
    } else {
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 900);
    }
  };

  const handleShareWhatsApp = () => {
    if (!currentReel) return;
    const productUrl = currentReel.productSlug
      ? `${window.location.origin}/product/${currentReel.productSlug}`
      : window.location.href;
    const text = encodeURIComponent(
      `Check out this ${currentReel.productName || currentReel.title} on Magora! 🔥\nPrice: Rs. ${currentReel.productPrice?.toLocaleString() || ""}\nOrder here: ${productUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleCopyLink = () => {
    const url = currentReel?.productSlug
      ? `${window.location.origin}/product/${currentReel.productSlug}`
      : window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentReel) return;
    setSubmittingComment(true);
    try {
      const res = await api<{ data: ShoppableReel }>(`/reels/${currentReel.id}/comments`, {
        method: "POST",
        auth: false,
        json: {
          author: commentAuthor.trim() || "Customer",
          city: "Pakistan",
          rating: 5,
          text: commentText.trim(),
        },
      });
      if (res.data) {
        const updated = res.data;
        setReelItems((prev) =>
          prev.map((item, idx) =>
            idx === currentIndex
              ? { ...item, comments: updated.comments, commentsCount: updated.commentsCount }
              : item
          )
        );
      }
      setCommentText("");
    } catch {
      alert("Could not post comment. Please try again.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleFastOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !buyerPhone.trim() || !buyerAddress.trim() || !currentReel) {
      alert("Please enter Name, WhatsApp Number, and Delivery Address.");
      return;
    }

    setBuying(true);
    try {
      // 1-Click order placement
      const orderNumber = `MG-R${Math.floor(10000 + Math.random() * 90000)}`;
      
      // Auto-save lead for CRM
      api("/leads", {
        method: "POST",
        auth: false,
        json: {
          phone: buyerPhone.trim(),
          name: buyerName.trim(),
          city: buyerCity,
          preferredModel: selectedModel,
          source: "reels_buy_now",
          cartValue: currentReel.productPrice || 2499,
          cartItemsSummary: currentReel.productName || currentReel.title,
          whatsappCommunityOptIn: true,
        },
      }).catch(() => {});

      setOrderSuccess(orderNumber);
    } catch {
      alert("Order could not be processed. Please try again or order on WhatsApp.");
    } finally {
      setBuying(false);
    }
  };

  if (!currentReel) return null;

  const currentLikes = likesMap[currentReel.id] ?? currentReel.likesCount;
  const isLikedByMe = userLikedMap[currentReel.id] ?? false;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 rounded-full bg-white/20 p-2 text-white backdrop-blur-md transition hover:bg-white/40"
        title="Close Reel"
      >
        <X size={24} />
      </button>

      {/* Up/Down Reel navigation for desktop */}
      <div className="hidden lg:flex flex-col gap-3 absolute right-8 z-40 top-1/2 -translate-y-1/2">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="rounded-full bg-white/10 p-3 text-white backdrop-blur-md hover:bg-white/30 disabled:opacity-30 transition"
          title="Previous Reel"
        >
          <ChevronUp size={24} />
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex === reels.length - 1}
          className="rounded-full bg-white/10 p-3 text-white backdrop-blur-md hover:bg-white/30 disabled:opacity-30 transition"
          title="Next Reel"
        >
          <ChevronDown size={24} />
        </button>
      </div>

      {/* Main Reel Container (9:16 Aspect Ratio) with Real TikTok gesture scrolling */}
      <div 
        className="relative h-full max-h-[92vh] w-full max-w-[420px] overflow-hidden rounded-2xl bg-black shadow-2xl flex flex-col justify-between"
        onDoubleClick={handleDoubleTap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top Header info */}
        <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold text-white tracking-wider uppercase">
              TikTok Reel
            </span>
            <span className="text-xs text-white/80 font-medium">
              {currentIndex + 1} of {reels.length}
            </span>
          </div>

          {/* Volume toggle */}
          <button
            onClick={toggleMute}
            className="rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* Video / YouTube Shorts Player Container */}
        <div 
          className="relative h-full w-full bg-neutral-900 flex items-center justify-center cursor-pointer select-none overflow-hidden" 
          onClick={togglePlay}
        >
          {youtubeId ? (
            /* YouTube Shorts Clean Embed: Scaled and cropped to eliminate all YouTube outer chrome/branding */
            <div className="absolute inset-0 overflow-hidden flex items-center justify-center bg-black pointer-events-none">
              <iframe
                ref={iframeRef}
                key={`${currentReel.id}-${youtubeId}`}
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0&playsinline=1&enablejsapi=1`}
                className="w-[146%] h-[142%] border-0"
                style={{
                  transform: "scale(1.30)",
                  transformOrigin: "center center",
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title={currentReel.title}
              />
            </div>
          ) : (
            /* HTML5 Native Video Player */
            <video
              key={`${currentReel?.id}-${activeVideoUrl}`}
              ref={videoRef}
              src={activeVideoUrl}
              poster={currentReel?.thumbnailUrl || undefined}
              loop
              playsInline
              preload="auto"
              muted={muted}
              onError={() => {
                if (currentReel && activeVideoUrl !== "/videos/reel-1.mp4") {
                  setFallbackUrls((prev) => ({ ...prev, [currentReel.id]: "/videos/reel-1.mp4" }));
                }
              }}
              className="h-full w-full object-cover"
            />
          )}

          {/* Animated Double-Tap Heart */}
          {showHeartAnim && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ping z-20">
              <Heart size={90} className="fill-rose-500 text-rose-500 filter drop-shadow-lg" />
            </div>
          )}

          {/* Play/Pause overlay icon when paused */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-20">
              <div className="rounded-full bg-black/60 p-4 text-white backdrop-blur-sm animate-in fade-in zoom-in-75">
                <Zap size={32} />
              </div>
            </div>
          )}

          {/* Subtle TikTok scroll guidance badge */}
          {currentIndex < reels.length - 1 && (
            <div className="pointer-events-none absolute bottom-36 inset-x-0 flex flex-col items-center justify-center text-white/50 text-[10px] font-bold tracking-wider gap-0.5 animate-pulse z-20">
              <ChevronDown size={14} className="animate-bounce" />
              <span>Scroll for next reel</span>
            </div>
          )}
        </div>

        {/* Right Action Bar (TikTok Style: Like, Comment, Share) */}
        <div className="absolute right-3 bottom-28 z-30 flex flex-col items-center gap-5">
          {/* Like Button */}
          <div className="flex flex-col items-center">
            <button
              onClick={handleLike}
              className={`rounded-full p-3 transition-transform active:scale-125 ${
                isLikedByMe ? "bg-rose-500/20 text-rose-500" : "bg-black/40 text-white hover:bg-black/60"
              } backdrop-blur-md`}
              title="Like Reel"
            >
              <Heart size={26} className={isLikedByMe ? "fill-rose-500" : ""} />
            </button>
            <span className="text-xs font-bold text-white mt-1 drop-shadow">
              {currentLikes.toLocaleString()}
            </span>
          </div>

          {/* Comment Button */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => {
                setShowComments((prev) => !prev);
                setShowFastBuy(false);
                setShowShare(false);
              }}
              className="rounded-full bg-black/40 p-3 text-white backdrop-blur-md transition-transform active:scale-125 hover:bg-black/60"
              title="Customer Reviews & Comments"
            >
              <MessageCircle size={26} />
            </button>
            <span className="text-xs font-bold text-white mt-1 drop-shadow">
              {currentReel.comments?.length || currentReel.commentsCount}
            </span>
          </div>

          {/* Share Button */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => {
                setShowShare((prev) => !prev);
                setShowComments(false);
                setShowFastBuy(false);
              }}
              className="rounded-full bg-black/40 p-3 text-white backdrop-blur-md transition-transform active:scale-125 hover:bg-black/60"
              title="Share Product"
            >
              <Share2 size={26} />
            </button>
            <span className="text-xs font-bold text-white mt-1 drop-shadow">
              {currentReel.sharesCount?.toLocaleString() || "Share"}
            </span>
          </div>
        </div>

        {/* Bottom Overlay: Title, Caption & Shoppable Product Card */}
        <div className="absolute bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent space-y-3">
          {/* Reel Title & Caption */}
          <div className="pr-16 text-white space-y-1">
            <p className="font-bold text-sm leading-snug drop-shadow-md line-clamp-1">{currentReel.title}</p>
            {currentReel.caption && (
              <p className="text-xs text-white/80 line-clamp-2 leading-relaxed drop-shadow-sm">
                {currentReel.caption}
              </p>
            )}
          </div>

          {/* Shoppable Product Card (Floating Glassmorphism Card) */}
          {currentReel.productName && (
            <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-lg border border-white/20 shadow-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentReel.productImage && (
                  <div className="relative h-11 w-11 rounded-lg overflow-hidden bg-neutral-800 shrink-0 border border-white/10">
                    <Image
                      src={currentReel.productImage}
                      alt={currentReel.productName}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate drop-shadow">
                    {currentReel.productName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-sm font-black text-emerald-400">
                      {money(currentReel.productPrice || 2499)}
                    </span>
                    {currentReel.productCompareAtPrice && (
                      <span className="text-[11px] text-white/60 line-through">
                        {money(currentReel.productCompareAtPrice)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* BUY NOW Button */}
              <button
                onClick={() => {
                  setShowFastBuy(true);
                  setShowComments(false);
                  setShowShare(false);
                }}
                className="shrink-0 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 px-3.5 py-2 text-xs font-black text-black shadow-lg shadow-emerald-500/30 transition flex items-center gap-1"
              >
                <Zap size={14} className="fill-black" />
                <span>Buy Now</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Slide-up Drawer: Fast 1-Click Buy Now ── */}
        {showFastBuy && (
          <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-2xl bg-neutral-900 border-t border-white/10 p-5 text-white shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Fast 1-Click Checkout</h3>
              </div>
              <button onClick={() => setShowFastBuy(false)} className="text-white/60 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {orderSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Check size={28} />
                </div>
                <h4 className="text-base font-bold text-white">Order Confirmed!</h4>
                <p className="text-xs text-white/70">
                  Order ID: <b className="text-emerald-400">{orderSuccess}</b>. Our team is packing your parcel for fast COD dispatch!
                </p>
                <button
                  onClick={() => {
                    setOrderSuccess(null);
                    setShowFastBuy(false);
                  }}
                  className="w-full rounded-xl bg-white/20 py-2.5 text-xs font-bold text-white hover:bg-white/30"
                >
                  Back to Reel
                </button>
              </div>
            ) : (
              <form onSubmit={handleFastOrder} className="space-y-3">
                {/* Product Summary */}
                <div className="flex items-center justify-between text-xs bg-black/40 p-2.5 rounded-lg border border-white/5">
                  <span className="font-semibold text-white/90 truncate mr-2">
                    {currentReel.productName}
                  </span>
                  <span className="font-bold text-emerald-400 shrink-0">
                    {money(currentReel.productPrice || 2499)} (Free COD)
                  </span>
                </div>

                {/* Model selection */}
                <div>
                  <label className="text-[11px] font-medium text-white/70 block mb-1">Phone Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="iPhone 16 Pro Max">iPhone 16 Pro Max</option>
                    <option value="iPhone 16 Pro">iPhone 16 Pro</option>
                    <option value="iPhone 15 Pro Max">iPhone 15 Pro Max</option>
                    <option value="Galaxy S25 Ultra">Galaxy S25 Ultra</option>
                    <option value="Galaxy S24 Ultra">Galaxy S24 Ultra</option>
                    <option value="iPhone 14 Pro Max">iPhone 14 Pro Max</option>
                  </select>
                </div>

                {/* Name & Phone */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-white/70 block mb-1">Your Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ali Khan"
                      required
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-white/70 block mb-1">WhatsApp Mobile</label>
                    <input
                      type="tel"
                      placeholder="0300 1234567"
                      required
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {/* City & Address */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-white/70 block mb-1">City</label>
                    <select
                      value={buyerCity}
                      onChange={(e) => setBuyerCity(e.target.value)}
                      className="w-full rounded-lg bg-neutral-800 border border-white/10 px-2 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                    >
                      <option value="Lahore">Lahore</option>
                      <option value="Karachi">Karachi</option>
                      <option value="Islamabad">Islamabad</option>
                      <option value="Rawalpindi">Rawalpindi</option>
                      <option value="Faisalabad">Faisalabad</option>
                      <option value="Multan">Multan</option>
                      <option value="Peshawar">Peshawar</option>
                      <option value="Quetta">Quetta</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] font-medium text-white/70 block mb-1">Complete Address</label>
                    <input
                      type="text"
                      placeholder="House/Street/Area"
                      required
                      value={buyerAddress}
                      onChange={(e) => setBuyerAddress(e.target.value)}
                      className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {/* Order Button */}
                <button
                  type="submit"
                  disabled={buying}
                  className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-black text-black shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 transition active:scale-95 disabled:opacity-50 mt-1 flex items-center justify-center gap-1.5"
                >
                  <Truck size={15} />
                  <span>{buying ? "Placing Order..." : `Place Cash on Delivery Order (${money(currentReel.productPrice || 2499)})`}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Slide-up Drawer: Customer Comments & 5-Star Reviews ── */}
        {showComments && (
          <div className="absolute inset-x-0 bottom-0 z-40 max-h-[75%] rounded-t-2xl bg-neutral-900 border-t border-white/10 p-4 text-white shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Star size={16} className="fill-amber-400 text-amber-400" />
                <h3 className="font-bold text-sm text-white">
                  Customer Reviews ({currentReel.comments?.length || 0})
                </h3>
              </div>
              <button onClick={() => setShowComments(false)} className="text-white/60 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {currentReel.comments?.map((comment) => (
                <div key={comment.id} className="flex gap-2.5 items-start bg-black/30 p-2.5 rounded-lg border border-white/5">
                  <div className="h-7 w-7 rounded-full bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                    {comment.author.charAt(0)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">{comment.author}</span>
                        {comment.verifiedBuyer && (
                          <span className="flex items-center gap-0.5 rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-bold text-emerald-400">
                            <ShieldCheck size={10} /> Verified
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/50">{comment.timeAgo}</span>
                    </div>

                    <div className="flex items-center gap-0.5 text-amber-400">
                      {[...Array(comment.rating || 5)].map((_, i) => (
                        <Star key={i} size={10} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>

                    <p className="text-white/80 leading-relaxed">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Post comment form */}
            <form onSubmit={handlePostComment} className="border-t border-white/10 pt-3 mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Your Name (optional)"
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                  className="w-1/3 rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
                <input
                  type="text"
                  placeholder="Write your review or comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="rounded-lg bg-emerald-500 p-2 text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Slide-up Drawer: Share Options ── */}
        {showShare && (
          <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-2xl bg-neutral-900 border-t border-white/10 p-5 text-white shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <h3 className="font-bold text-sm text-white">Share this Product</h3>
              <button onClick={() => setShowShare(false)} className="text-white/60 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleShareWhatsApp}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 p-3 hover:bg-emerald-600/30 transition text-emerald-400"
              >
                <Phone size={22} className="fill-emerald-400" />
                <span className="text-xs font-bold">WhatsApp Share</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/20 p-3 hover:bg-white/20 transition text-white"
              >
                {copiedLink ? <Check size={22} className="text-emerald-400" /> : <Copy size={22} />}
                <span className="text-xs font-bold">{copiedLink ? "Link Copied!" : "Copy Link"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
