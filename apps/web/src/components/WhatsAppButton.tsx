"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  MapPin,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { WHATSAPP } from "@/lib/config";
import { api } from "@/lib/client-api";
import { cn, money } from "@/lib/format";
import { useCart } from "@/stores/cart";
import { useAuth } from "@/stores/auth";
import type { Order } from "@/lib/types";


interface SavedAddress {
  id: number;
  name: string;
  phone: string;
  city: string;
  line1: string;
  isDefault?: boolean;
}

interface PhoneOption {
  slug: string;
  name: string;
  brand: string;
}

interface ProductOption {
  slug: string;
  name: string;
  basePrice: number;
  category: string;
  colors: { name: string; hex: string }[];
}

const POPULAR_PHONES: PhoneOption[] = [
  { slug: "iphone-16-pro-max", name: "iPhone 16 Pro Max", brand: "apple" },
  { slug: "iphone-16-pro", name: "iPhone 16 Pro", brand: "apple" },
  { slug: "iphone-15-pro-max", name: "iPhone 15 Pro Max", brand: "apple" },
  { slug: "iphone-15-pro", name: "iPhone 15 Pro", brand: "apple" },
  { slug: "iphone-14-pro-max", name: "iPhone 14 Pro Max", brand: "apple" },
  { slug: "samsung-galaxy-s25-ultra", name: "Galaxy S25 Ultra", brand: "samsung" },
  { slug: "samsung-galaxy-s24-ultra", name: "Galaxy S24 Ultra", brand: "samsung" },
  { slug: "google-pixel-9-pro-xl", name: "Pixel 9 Pro XL", brand: "google" },
];

const QUICK_PRODUCTS: ProductOption[] = [
  {
    slug: "crystal-clear-magsafe-case",
    name: "Crystal Clear MagSafe Case",
    basePrice: 2799,
    category: "magsafe-cases",
    colors: [
      { name: "Clear", hex: "#f4f7fb" },
      { name: "Titanium Gray", hex: "#8a8d91" },
      { name: "Deep Blue", hex: "#1e3a8a" },
    ],
  },
  {
    slug: "frosted-matte-magsafe-case",
    name: "Frosted Matte MagSafe Case",
    basePrice: 2899,
    category: "magsafe-cases",
    colors: [
      { name: "Matte Black", hex: "#1f2024" },
      { name: "Titanium Gray", hex: "#8a8d91" },
      { name: "Deep Purple", hex: "#4c1d95" },
    ],
  },
  {
    slug: "liquid-silicone-magsafe-case",
    name: "Liquid Silicone MagSafe Case",
    basePrice: 2499,
    category: "magsafe-cases",
    colors: [
      { name: "Midnight Black", hex: "#18181b" },
      { name: "Chalk Pink", hex: "#fbcfe8" },
      { name: "Storm Blue", hex: "#0284c7" },
    ],
  },
  {
    slug: "9h-tempered-glass",
    name: "9H Tempered Glass Protector",
    basePrice: 999,
    category: "screen-protectors",
    colors: [{ name: "Crystal Clear 9H", hex: "#ffffff" }],
  },
  {
    slug: "carbon-fiber-skin",
    name: "Carbon Fiber 3D Textured Skin",
    basePrice: 1499,
    category: "skins",
    colors: [
      { name: "Matte Black Carbon", hex: "#18181b" },
      { name: "Gunmetal Gray", hex: "#475569" },
    ],
  },
  {
    slug: "65w-gan-charger",
    name: "65W GaN 3-Port Fast Charger",
    basePrice: 3999,
    category: "gadgets",
    colors: [
      { name: "Glossy White", hex: "#ffffff" },
      { name: "Matte Black", hex: "#18181b" },
    ],
  },
];

const PK_CITIES = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar",
  "Quetta", "Hyderabad", "Sialkot", "Gujranwala", "Bahawalpur", "Sargodha", "Sukkur",
  "Abbottabad", "Mardan", "Sahiwal", "Rahim Yar Khan", "Larkana", "Gujrat", "Other",
];

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
}

export function WhatsAppButton() {
  const p = usePathname();
  const [mode, setMode] = useState<"whatsapp" | "chatbot">("whatsapp");
  const [open, setOpen] = useState(false);

  // Guided order state
  const [step, setStep] = useState<"phone" | "product" | "color" | "address" | "success">("phone");
  const [selectedPhone, setSelectedPhone] = useState<PhoneOption | null>(null);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", city: "Karachi", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Chat message history
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const cart = useCart();
  const { user } = useAuth();
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [useCustomAddress, setUseCustomAddress] = useState(false);

  // Fetch saved addresses if logged in
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await api<{ data: SavedAddress[] }>("/me/addresses");
        if (res.data && res.data.length > 0) {
          setSavedAddresses(res.data);
          const def = res.data.find((a) => a.isDefault) ?? res.data[0];
          setForm({
            name: def.name || user.name || "",
            phone: def.phone || user.phone || "",
            city: def.city || "Karachi",
            address: def.line1 || "",
          });
        } else {
          setForm((prev) => ({
            ...prev,
            name: user.name || prev.name,
            phone: user.phone || prev.phone,
          }));
        }
      } catch {
        // guest or auth error
      }
    })();
  }, [user]);

  // Mode cycling timer:
  // Starts with WhatsApp for 10s -> then Chatbot for 60s -> then alternates 60s WhatsApp / 60s Chatbot
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const initialTimer = setTimeout(() => {
      setMode("chatbot");
      intervalId = setInterval(() => {
        setMode((prev) => (prev === "whatsapp" ? "chatbot" : "whatsapp"));
      }, 60000);
    }, 10000);

    return () => {
      clearTimeout(initialTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Initialize welcoming chat message on mount
  useEffect(() => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    queueMicrotask(() => {
      setMessages([
        {
          id: "welcome-1",
          sender: "bot",
          text: user
            ? `Assalam o Alaikum, ${user.name}! 👋 Main aapka Magora AI Order Assistant hoon. Aap already logged in hain! Sirf 1–2 clicks mein aapka Cash on Delivery (COD) order yahan book ho jayega.`
            : "Assalam o Alaikum! 👋 Main Magora AI Order Assistant hoon. Agar aap ko website par order karna samajh nahi aa raha, toh sirf 2–3 clicks mein aap ka Cash on Delivery (COD) order yahan book ho jayega!",
          time: now,
        },
      ]);
    });
  }, [user]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  if (p.startsWith("/admin") || p.startsWith("/rider")) return null;

  const buildWhatsAppUrl = (customText?: string) => {
    const text =
      customText ??
      (selectedProduct && selectedPhone
        ? `Assalam o Alaikum! Mujhe order karna hai:\n• Product: ${selectedProduct.name}\n• Phone: ${selectedPhone.name}\n• Color: ${selectedColor?.name ?? "Any"}\n• Payment: Cash on Delivery`
        : "Assalam o Alaikum! Mujhe Magora Store se order place karne mein help chahiye.");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = inputText.trim();
    if (!query) return;

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = { id: String(Date.now()), sender: "user", text: query, time: now };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");

    // Smart assistant matching
    const qLower = query.toLowerCase();
    setTimeout(() => {
      let botReply = "Aap neeche 'Quick Order' options se apna phone aur case select karein, ya direct WhatsApp par rabta karein!";
      if (qLower.includes("delivery") || qLower.includes("din") || qLower.includes("time") || qLower.includes("charges")) {
        botReply = "Delivery pure Pakistan mein 2–4 working days mein hoti hai (Karachi mein 1–2 din). Delivery charges sirf Rs. 200 hain, aur Rs. 3,000 se upar bilkul FREE delivery hai! 🚚";
      } else if (qLower.includes("cash") || qLower.includes("cod") || qLower.includes("advance") || qLower.includes("pay")) {
        botReply = "Advance payment ki koi zarurat nahi hai! Hum 100% Cash on Delivery (COD) provide karte hain. Rider parcel laye tab cash dain. Parcel check karne ki bhi ijazat hai. 💵";
      } else if (qLower.includes("return") || qLower.includes("change") || qLower.includes("warranty")) {
        botReply = "Hamari 7-day easy exchange & return policy hai. Agar koi wrong item ya issue ho toh WhatsApp par message karein, hum foran replace kar dete hain. 🛡️";
      } else if (qLower.includes("whatsapp") || qLower.includes("number")) {
        botReply = `Aap direct hamare WhatsApp number (+92 300 0000000) par bhi order place kar sakte hain. Neeche WhatsApp button dabayein! 💬`;
      } else if (qLower.includes("order") || qLower.includes("buy") || qLower.includes("kharid")) {
        botReply = "Aap neeche apna phone model select karein, phir case aur address dein. Order khud book ho jayega!";
      }

      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), sender: "bot", text: botReply, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);
    }, 450);
  };

  const handleConfirmOrder = async () => {
    if (!form.name.trim()) return setErrorMessage("Apna naam zaroor likhein");
    if (!form.phone.trim() || form.phone.length < 10) return setErrorMessage("Sahi Pakistani mobile number likhein (e.g. 0300 1234567)");
    if (!form.address.trim() || form.address.length < 5) return setErrorMessage("Mukammal ghar/dukan ka address likhein");

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Ensure cart exists
      const cartId = await cart.ensure();

      // 2. Fetch product details to find the exact variant
      const pData = await api<{ data: { variants: { id: number; modelId?: number; colorId: number; inStock: boolean }[]; models: { id: number; slug: string }[]; colors: { id: number; name: string }[] } }>(
        `/products/${selectedProduct?.slug ?? "crystal-clear-magsafe-case"}`,
        { auth: false },
      );

      const targetModel = pData.data.models.find((m) => m.slug === selectedPhone?.slug) ?? pData.data.models[0];
      const targetColor = pData.data.colors.find((c) => c.name.toLowerCase() === (selectedColor?.name ?? "").toLowerCase()) ?? pData.data.colors[0];

      const variant =
        pData.data.variants.find((v) => (targetModel ? v.modelId === targetModel.id : true) && v.colorId === targetColor?.id) ??
        pData.data.variants[0];

      if (variant) {
        await cart.add(variant.id, 1);
      }

      // 3. Place COD order via checkout API
      const res = await api<{ data: { order: Order } }>("/checkout", {
        method: "POST",
        json: {
          cartId,
          customer: { name: form.name.trim(), phone: form.phone.trim() },
          address: { city: form.city, line1: form.address.trim() },
          paymentMethod: "cod",
          source: "web",
        },
      });

      setOrderResult(res.data.order);
      setStep("success");
      cart.reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Order place nahi ho saka. WhatsApp par order karein!";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPhones = POPULAR_PHONES.filter(
    (m) => !phoneSearch || m.name.toLowerCase().includes(phoneSearch.toLowerCase()),
  );

  if (p?.startsWith("/admin")) return null;

  return (
    <>
      {/* ───── Fixed Floating Action Button (10s WhatsApp / 1min Chatbot cycle) ───── */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3">
        {/* Subtle tooltip pill indicating active assistant */}
        {!open && (
          <div
            onClick={() => {
              if (mode === "chatbot") setOpen(true);
              else window.open(buildWhatsAppUrl(), "_blank");
            }}
            className="glass cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-md transition hover:scale-105"
          >
            {mode === "chatbot" ? (
              <span className="flex items-center gap-1.5 text-ink">
                <Sparkles size={13} className="text-[#38bdf8]" /> 3D AI Assistant
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-ink">
                <span className="h-2 w-2 rounded-full bg-[#25d366]" /> Chat on WhatsApp
              </span>
            )}
          </div>
        )}

        {/* Floating Bubble Button */}
        {open ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
            className="grid h-14 w-14 place-items-center rounded-full bg-[#18181b] text-white shadow-xl transition-all duration-300 hover:scale-110"
          >
            <X size={24} className="text-white" />
          </button>
        ) : mode === "whatsapp" ? (
          <button
            type="button"
            onClick={() => window.open(buildWhatsAppUrl(), "_blank")}
            aria-label="Chat on WhatsApp"
            className="grid h-14 w-14 place-items-center rounded-full bg-[#25d366] text-white shadow-[0_12px_28px_-6px_rgba(37,211,102,0.7)] transition-all duration-300 hover:scale-110"
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden>
              <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3M12 21.8h0c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C2.7 15.6 2.2 13.8 2.2 12 2.2 6.6 6.6 2.2 12 2.2c2.6 0 5.1 1 6.9 2.9 1.8 1.8 2.9 4.3 2.9 6.9 0 5.4-4.4 9.8-9.8 9.8M20.4 3.6C18.2 1.3 15.2 0 12 0 5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6c1.8 1 3.8 1.5 5.8 1.5 6.6 0 12-5.4 12-12 0-3.2-1.2-6.2-3.6-8.3" />
            </svg>
          </button>
        ) : (
          /* 3D Robot Avatar - Floating Naturally Without Background */
          <div
            onClick={() => setOpen(true)}
            role="button"
            tabIndex={0}
            aria-label="Open 3D AI Assistant"
            className="relative cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95 group"
          >
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 opacity-25 blur-md group-hover:opacity-50 transition" />
            <div className="relative h-20 w-20 drop-shadow-[0_10px_22px_rgba(79,70,229,0.35)]">
              <Image
                src="/images/ai-avatar.png"
                alt="Magora 3D AI Chatbot"
                width={80}
                height={80}
                priority
                className="h-full w-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)]"
              />
            </div>
            <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
          </div>
        )}
      </div>

      {/* ───── AI Order Assistant Modal / Drawer ───── */}
      {open && (
        <div
          role="dialog"
          aria-label="Order Assistant"
          className="glass-strong fixed bottom-24 right-3 z-50 flex max-h-[82vh] w-[calc(100%-24px)] max-w-[420px] flex-col overflow-hidden rounded-[28px] border border-white/60 shadow-2xl transition-all sm:right-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 bg-gradient-to-r from-[#4a65ff]/10 via-[#7c3aed]/10 to-[#ec4899]/10 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="relative h-10 w-10 shrink-0">
                <Image
                  src="/images/ai-avatar.png"
                  alt="Magora AI"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain drop-shadow-sm"
                />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500 shadow-xs" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold leading-tight">Magora AI Assistant</h3>
                <p className="text-[11px] font-medium text-muted">
                  {user ? `Logged in as ${user.name}` : "2-Click Cash on Delivery Order"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* WhatsApp direct fallback shortcut */}
              <a
                href={buildWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp par order karein"
                className="flex items-center gap-1 rounded-full bg-[#25d366]/15 px-2.5 py-1 text-[11px] font-bold text-[#15803d] hover:bg-[#25d366]/25"
              >
                WhatsApp 💬
              </a>
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-ink hover:bg-black/10"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Chat & Guided Order Body */}
          <div className="flex-1 space-y-3.5 overflow-y-auto p-4 text-[13px]">
            {/* Conversation Messages */}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex flex-col gap-1 max-w-[88%]", m.sender === "user" ? "ml-auto items-end" : "mr-auto items-start")}
              >
                <div
                  className={cn(
                    "rounded-[18px] px-3.5 py-2.5 leading-relaxed",
                    m.sender === "user" ? "bg-accent text-white rounded-br-sm shadow-sm" : "bg-white text-ink rounded-bl-sm shadow-sm border border-black/5",
                  )}
                >
                  {m.text}
                </div>
                <span className="text-[10px] text-muted">{m.time}</span>
              </div>
            ))}

            {/* Step 1: Select Phone Model */}
            {step === "phone" && (
              <div className="card space-y-2.5 p-3.5 border border-black/5 bg-white/95">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-accent">Step 1 of 3</span>
                  <span className="text-[11px] text-muted">Select your phone</span>
                </div>
                <input
                  type="text"
                  placeholder="Apna phone model search karein..."
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(e.target.value)}
                  className="input h-8 text-xs"
                />
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                  {filteredPhones.map((m) => (
                    <button
                      key={m.slug}
                      onClick={() => {
                        setSelectedPhone(m);
                        setStep("product");
                        setMessages((prev) => [
                          ...prev,
                          { id: String(Date.now()), sender: "user", text: m.name, time: "Just now" },
                          { id: String(Date.now() + 1), sender: "bot", text: `Aala intikhab! ${m.name} ke liye konsi item chahiye?`, time: "Just now" },
                        ]);
                      }}
                      className="chip text-[12px] hover:!bg-accent hover:!text-white transition"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Select Product */}
            {step === "product" && selectedPhone && (
              <div className="card space-y-2.5 p-3.5 border border-black/5 bg-white/95">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-accent">Step 2 of 3</span>
                  <button onClick={() => setStep("phone")} className="text-[11px] text-muted underline">
                    Change {selectedPhone.name}
                  </button>
                </div>
                <p className="text-[12px] font-semibold">Konsi accessory order karni hai?</p>
                <div className="grid gap-1.5">
                  {QUICK_PRODUCTS.map((prod) => (
                    <button
                      key={prod.slug}
                      onClick={() => {
                        setSelectedProduct(prod);
                        setSelectedColor(prod.colors[0]);
                        setStep(prod.colors.length > 1 ? "color" : "address");
                        setMessages((prev) => [
                          ...prev,
                          { id: String(Date.now()), sender: "user", text: prod.name, time: "Just now" },
                          {
                            id: String(Date.now() + 1),
                            sender: "bot",
                            text: `${prod.name} (${money(prod.basePrice)}). Apna colour confirm karein aur address dein.`,
                            time: "Just now",
                          },
                        ]);
                      }}
                      className="flex items-center justify-between rounded-xl border border-black/5 p-2 text-left transition hover:bg-black/[0.03]"
                    >
                      <div>
                        <b className="block text-[12.5px] font-semibold">{prod.name}</b>
                        <span className="text-[11px] text-muted">{selectedPhone.name}</span>
                      </div>
                      <span className="text-xs font-bold text-accent">{money(prod.basePrice)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Color Selection */}
            {step === "color" && selectedProduct && (
              <div className="card space-y-2.5 p-3.5 border border-black/5 bg-white/95">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-accent">Step 3 of 3</span>
                  <span className="text-[11px] text-muted">Choose Color</span>
                </div>
                <p className="text-[12px] font-semibold">Colour pasand karein:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.colors.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        setSelectedColor(c);
                        setStep("address");
                      }}
                      className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium transition hover:border-accent"
                    >
                      <span className="h-3.5 w-3.5 rounded-full border border-black/20" style={{ backgroundColor: c.hex }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Address & Instant 1-Click COD Order */}
            {step === "address" && selectedProduct && selectedPhone && (
              <div className="card space-y-2.5 p-3.5 border border-black/5 bg-white/95">
                <div className="rounded-xl bg-accent/10 p-2.5 text-xs">
                  <b className="block font-bold text-ink">{selectedProduct.name}</b>
                  <span className="text-muted">
                    {selectedPhone.name} · {selectedColor?.name}
                  </span>
                  <div className="mt-1 flex items-center justify-between font-semibold">
                    <span>Cash on Delivery Total:</span>
                    <span className="text-accent">{money(selectedProduct.basePrice + 200)}</span>
                  </div>
                </div>

                {user && savedAddresses.length > 0 && !useCustomAddress ? (
                  <div className="space-y-3 pt-1">
                    <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-3 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-ink">
                        <MapPin size={15} className="text-accent" />
                        <span>Aap ka Saved Delivery Address:</span>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 text-xs shadow-sm space-y-1 border border-black/5">
                        <b className="block text-ink font-semibold">{savedAddresses[0].name || user.name}</b>
                        <p className="text-muted leading-relaxed">{savedAddresses[0].line1}, {savedAddresses[0].city}</p>
                        <p className="text-[11px] text-accent font-medium">📞 {savedAddresses[0].phone || user.phone}</p>
                      </div>
                      <p className="text-[11px] text-muted">
                        Aap apne isi address par parcel mangwana chahte hain ya naya address enter karein?
                      </p>
                    </div>

                    {errorMessage && <p className="text-[11.5px] font-medium text-danger">{errorMessage}</p>}

                    <div className="space-y-1.5">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleConfirmOrder}
                        className="btn btn-primary h-10 w-full text-xs font-bold shadow-md shadow-accent/20"
                      >
                        {submitting ? "Booking Order..." : "🚀 Haan, Isi Address Par Bhejein (1-Click Order)"}
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setUseCustomAddress(true)}
                        className="btn btn-secondary h-8 w-full text-xs font-semibold"
                      >
                        ✏️ Naya Address Dalein
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1 text-xs">
                    {user && savedAddresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setUseCustomAddress(false)}
                        className="mb-1 text-[11px] font-semibold text-accent underline flex items-center gap-1"
                      >
                        ← Saved Address Wapas Chunein
                      </button>
                    )}
                    <div>
                      <label className="mb-0.5 block font-semibold text-muted">Aap ka Naam:</label>
                      <input
                        type="text"
                        placeholder="e.g. Ali Khan"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="input h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block font-semibold text-muted">Mobile Number (WhatsApp):</label>
                      <input
                        type="tel"
                        placeholder="0300 1234567"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="input h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block font-semibold text-muted">City:</label>
                      <select
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        className="input h-8 text-xs"
                      >
                        {PK_CITIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-0.5 block font-semibold text-muted">Complete Delivery Address:</label>
                      <textarea
                        rows={2}
                        placeholder="Ghar / Street / Mohalla number..."
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="input py-1 text-xs"
                      />
                    </div>

                    {errorMessage && <p className="text-[11.5px] font-medium text-danger">{errorMessage}</p>}

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleConfirmOrder}
                      className="btn btn-primary h-9 w-full text-xs font-bold"
                    >
                      {submitting ? "Booking Order..." : "Confirm Cash on Delivery Order 🚀"}
                    </button>
                  </div>
                )}

                {/* Direct WhatsApp Fallback */}
                <div className="pt-2 text-center">
                  <p className="text-[11px] text-muted">Samajh nahi aa raha? WhatsApp par direct order karein:</p>
                  <a
                    href={buildWhatsAppUrl(
                      `Assalam o Alaikum! Mujhe order karna hai:\n• Product: ${selectedProduct.name}\n• Phone: ${selectedPhone.name}\n• Color: ${selectedColor?.name ?? "Any"}\n• Naam: ${form.name || "Aap ka grahak"}\n• City: ${form.city}\n• Payment: Cash on Delivery`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-full bg-[#25d366] text-xs font-bold text-white shadow-sm hover:opacity-90"
                  >
                    WhatsApp Par Order Karein 💬
                  </a>
                </div>
              </div>
            )}

            {/* Step 5: Success screen */}
            {step === "success" && orderResult && (
              <div className="card space-y-3 p-4 text-center bg-white/95">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="text-base font-bold text-ink">🎉 Mubarak Ho! Order Book Ho Gaya</h4>
                <div className="rounded-xl bg-black/[0.03] p-2.5 text-xs text-left space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted">Order Number:</span>
                    <b className="font-bold text-accent">{orderResult.number}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Total (COD):</span>
                    <b>{money(orderResult.totals.total)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Payment:</span>
                    <span>Cash on Delivery</span>
                  </div>
                </div>
                <p className="text-[11.5px] text-muted leading-relaxed">
                  Rider parcel deliver karte waqt cash lega. Parcel khol kar check karne ki ijazat hai. 📦
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/order/${orderResult.number}?token=${orderResult.accessToken}`}
                    onClick={() => setOpen(false)}
                    className="btn btn-primary h-8 flex-1 text-xs"
                  >
                    Track Order
                  </Link>
                  <button
                    onClick={() => {
                      setStep("phone");
                      setSelectedPhone(null);
                      setSelectedProduct(null);
                      setOrderResult(null);
                    }}
                    className="chip h-8 text-xs"
                  >
                    Naya Order
                  </button>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 border-t border-black/5 bg-white/80 p-2.5">
            <input
              type="text"
              placeholder="Kuch poochna hai? Yahan likhein..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="input h-9 text-xs flex-1"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40"
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
