"use client";

import { useEffect, useState } from "react";
import { Copy, Check, ExternalLink, QrCode, Smartphone, Sparkles, X, Glasses } from "lucide-react";

interface ArViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  modelName: string;
  colorName: string;
  colorHex: string;
  productUrl: string;
}

export function ArViewerModal({
  isOpen,
  onClose,
  productName,
  modelName,
  colorName,
  colorHex,
  productUrl,
}: ArViewerModalProps) {
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const ios = /iPad|iPhone|iPod/.test(ua);
    const android = /Android/.test(ua);
    setIsIos(ios);
    setIsAndroid(android);
    setIsMobile(ios || android);
  }, []);

  if (!isOpen) return null;

  const currentUrl = typeof window !== "undefined" ? window.location.href : productUrl;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(currentUrl)}&bgcolor=ffffff&color=0b0d12&margin=1`;

  const handleLaunchMobileAr = () => {
    if (isIos) {
      // Apple AR QuickLook fallback / trigger
      window.location.href = currentUrl;
    } else if (isAndroid) {
      // Android SceneViewer trigger
      const sceneViewerUrl = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf"
      )}&mode=ar_only&resizable=false&title=${encodeURIComponent(
        `${productName} (${modelName})`
      )}#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;end;`;
      window.location.href = sceneViewerUrl;
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card max-w-md w-full p-5 sm:p-6 rounded-[30px] shadow-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#151821] overflow-hidden animate-in zoom-in-95 duration-200 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent font-bold">
              <Glasses size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink flex items-center gap-1.5">
                <span>View in Augmented Reality</span>
                <span className="rounded-full bg-accent/15 text-accent px-1.5 py-0.2 text-[9.5px] font-bold">1:1 AR</span>
              </h3>
              <p className="text-xs text-muted truncate max-w-[240px]">
                {productName} · {modelName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted hover:text-ink transition"
            aria-label="Close AR Modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content based on device */}
        {isMobile ? (
          <div className="text-center space-y-4 py-2">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-accent/10 text-accent">
              <Smartphone size={36} className="animate-bounce" />
            </div>
            <div>
              <h4 className="text-base font-bold text-ink">Apne Table / Desk Par Dekhein</h4>
              <p className="mt-1 text-xs text-muted leading-relaxed max-w-xs mx-auto">
                Aap ke phone ka camera open ho ga aur yeh {modelName} ka case 1:1 true size mein aap ke samne table par place ho jaye ga.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLaunchMobileAr}
              className="btn btn-primary h-12 w-full text-sm font-bold shadow-lg shadow-accent/25 flex items-center justify-center gap-2"
            >
              <Sparkles size={16} />
              <span>Launch AR Camera (Start AR)</span>
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4 py-1">
            <div className="mx-auto rounded-2xl bg-white p-3 border-2 border-accent/20 shadow-md inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeUrl}
                alt="Scan to view in AR"
                width={190}
                height={190}
                className="rounded-xl"
              />
            </div>

            <div>
              <h4 className="text-sm font-bold text-ink flex items-center justify-center gap-1.5">
                <QrCode size={16} className="text-accent" />
                <span>Camera se QR Code Scan Karein</span>
              </h4>
              <p className="mt-1 text-xs text-muted leading-relaxed max-w-xs mx-auto">
                Apne iPhone ya Android mobile se yeh QR code scan karein aur is case ko apne room ya table par 1:1 true physical scale mein dekhein!
              </p>
            </div>

            <div className="pt-2 border-t border-line flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="input h-9 flex-1 text-xs font-mono text-muted truncate"
              />
              <button
                type="button"
                onClick={copyLink}
                className="btn btn-secondary h-9 px-3 text-xs font-bold inline-flex items-center gap-1 shrink-0"
              >
                {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-2.5 text-center text-[11px] text-muted">
          ✓ Compatible with Apple iOS 12+ (QuickLook) & Android 8+ (ARCore SceneViewer)
        </div>
      </div>
    </div>
  );
}
