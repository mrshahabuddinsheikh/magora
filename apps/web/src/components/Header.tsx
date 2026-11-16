"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, ShoppingBag, User, X, Truck, ChevronRight, ChevronDown, ImagePlus } from "lucide-react";
import { useCart } from "@/stores/cart";
import { useAuth } from "@/stores/auth";
import { usePrefs } from "@/stores/prefs";
import { useSection, useCurrentSection } from "@/stores/section";
export { useCurrentSection };
import { SearchOverlay } from "./SearchOverlay";
import { MegaPanel, GadgetMegaPanel, type MegaTab } from "./MegaMenu";
import { SectionIcon } from "./SectionIcon";
import { GadgetThumb } from "./GadgetThumb";
import { CATEGORIES, sectionFromPath, type CategoryDef } from "@/lib/categories";
import { api } from "@/lib/client-api";
import { cn, shortModel } from "@/lib/format";
import { STORE_NAME } from "@/lib/config";
import { ThemeToggle } from "./ThemeToggle";
import type { BrandWithModels, CategorySlug } from "@/lib/types";

let brandsCache: BrandWithModels[] | null = null;
const FALLBACK_BRANDS = [
  { slug: "apple", name: "iPhone" },
  { slug: "samsung", name: "Samsung" },
  { slug: "google", name: "Google Pixel" },
];

export function Logo({ className, section }: { className?: string; section?: CategoryDef }) {
  return (
    <Link href={section?.home ?? "/"} aria-label={`${STORE_NAME} ${section?.name ?? ""} home`} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[#4a65ff] via-[#7c3aed] to-[#e11d74] shadow-[0_6px_16px_-6px_rgba(79,70,229,0.8)]">
        <span className="h-4 w-4 rounded-full border-[2.5px] border-white/95" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[1.15rem] uppercase tracking-[0.18em]">{STORE_NAME}</span>
        {section && <span className="mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-accent">{section.short}</span>}
      </span>
    </Link>
  );
}


/**
 * Small icon switcher between the four shops. The current one shows its name;
 * on wide screens the others slide their name out on hover, inside the pill
 * (nothing pops outside the header, so nothing can overlap it).
 */
function SectionSwitch({ current, className }: { current: CategorySlug; className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5 rounded-full bg-black/[0.04] dark:bg-white/10 p-1", className)} role="navigation" aria-label="Switch shop">
      {CATEGORIES.map((c) => {
        const on = c.slug === current;
        return (
          <Link
            key={c.slug}
            href={c.home}
            title={c.name}
            aria-label={c.name}
            aria-current={on ? "page" : undefined}
            className={cn(
              "group flex h-8 items-center rounded-full px-2.5 text-[13px] font-semibold transition-colors",
              on
                ? "bg-white text-ink shadow-sm dark:bg-white dark:text-neutral-950 font-bold"
                : "text-ink/55 hover:bg-white/80 hover:text-ink dark:text-neutral-300 dark:hover:bg-white/15 dark:hover:text-white",
            )}
          >
            <SectionIcon slug={c.slug} size={15} className={cn("shrink-0", on ? "text-ink dark:text-neutral-950" : "text-ink/55 dark:text-neutral-300")} />
            <span
              className={cn(
                "overflow-hidden whitespace-nowrap transition-[max-width,margin,opacity] duration-300 ease-out",
                on
                  ? "ml-0 hidden max-w-0 xl:ml-1.5 xl:inline xl:max-w-[100px]"
                  : "ml-0 max-w-0 opacity-0 xl:group-hover:ml-1.5 xl:group-hover:max-w-[100px] xl:group-hover:opacity-100",
              )}
            >
              {c.short}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function Header() {
  const count = useCart((s) => s.cart?.itemCount ?? 0);
  const openCart = useCart((s) => s.setOpen);
  const loadCart = useCart((s) => s.load);
  const initAuth = useAuth((s) => s.init);
  const user = useAuth((s) => s.user);
  const pathname = usePathname();
  const section = useCurrentSection();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [brands, setBrands] = useState<BrandWithModels[]>(brandsCache ?? []);
  const [mega, setMega] = useState(false);
  const [tab, setTab] = useState<MegaTab>("apple");
  const [mobileBrand, setMobileBrand] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    usePrefs.persist.rehydrate();
    useSection.persist.rehydrate();
    loadCart();
    initAuth();
    if (!brandsCache)
      api<{ data: BrandWithModels[] }>("/brands", { auth: false })
        .then((r) => {
          brandsCache = r.data;
          setBrands(r.data);
        })
        .catch(() => {});
  }, [loadCart, initAuth]);

  // a section home also becomes the remembered section
  const setSection = useSection((s) => s.setSection);
  useEffect(() => {
    const s = sectionFromPath(pathname);
    if (s) setSection(s);
  }, [pathname, setSection]);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setMenu(false);
      setMega(false);
    });
  }, [pathname, section.slug]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") setMega(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const openMega = (t: MegaTab) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setTab(t);
    setMega(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMega(false), 160);
  };
  const cancelClose = () => closeTimer.current && clearTimeout(closeTimer.current);

  if (pathname.startsWith("/admin") || pathname.startsWith("/rider")) return null;

  const gadgets = section.slug === "gadgets";
  const navBrands = brands.length ? brands : FALLBACK_BRANDS;
  /* nav items for this section; `tab` opens the crystal panel on that tab */
  const nav: { href: string; label: string; tab?: MegaTab; badge?: string; className?: string }[] = gadgets
    ? section.styles.map((s, i) => ({
        href: `/shop?category=${s.cat}`,
        label: s.name.replace("Charging ", ""),
        tab: s.cat,
        className: i >= 4 ? "hidden 2xl:flex" : i >= 3 ? "hidden xl:flex" : undefined,
      }))
    : [
        ...navBrands.slice(0, 3).map((b) => ({ href: `/shop?category=${section.slug}&brand=${b.slug}`, label: b.name, tab: b.slug })),
        ...(navBrands.length > 3 ? [{ href: `/shop?category=${section.slug}`, label: "More phones", tab: navBrands[3].slug }] : []),
        { href: `/shop?category=${section.slug}`, label: section.stylesLabel, tab: "styles" },
        ...(section.slug === "skins" ? [{ href: "/product/custom-photo-skin", label: "Your Photo", badge: "New", className: "hidden 2xl:flex" }] : []),
      ];

  const extraBrands = new Set(navBrands.slice(3).map((b) => b.slug));
  const isOn = (n: { label: string; tab?: MegaTab }) => tab === n.tab || (n.label === "More phones" && extraBrands.has(tab));

  return (
    <>
      {/* announcement strip — speaks for the current section */}
      <div className="relative z-40 overflow-hidden bg-[#0b0d12] text-[12.5px] text-white/85">
        <div key={section.slug} className="flex w-max animate-[marquee_38s_linear_infinite] gap-12 py-2 pl-6 sm:mx-auto sm:w-auto sm:animate-none sm:justify-center">
          {[0, 1].map((k) => (
            <div key={k} className={cn("flex gap-12", k === 1 && "sm:hidden")}>
              {section.strip.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* page dim while the mega menu is open */}
      <div
        aria-hidden
        className={cn("fixed inset-0 z-30 bg-[#0b0d12]/10 transition-opacity duration-300", mega ? "opacity-100" : "pointer-events-none opacity-0")}
        onMouseEnter={scheduleClose}
        onClick={() => setMega(false)}
      />

      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5" onMouseLeave={scheduleClose} onMouseEnter={cancelClose}>
        <div
          className={cn(
            "mx-auto max-w-7xl overflow-hidden px-2.5 transition-[border-radius,background-color,box-shadow] duration-300 sm:px-4",
            mega ? "crystal rounded-[30px]" : cn("glass rounded-[30px]", scrolled && "glass-strong"),
          )}
        >
          <div className="flex h-[60px] items-center gap-2">
            {/* mobile: menu */}
            <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/70 lg:hidden" aria-label="Open menu" onClick={() => setMenu(true)}>
              <Menu size={20} />
            </button>

            <Logo section={section} className="mx-auto lg:mx-0" />

            <nav className="ml-5 hidden min-w-0 flex-1 items-center gap-0.5 overflow-hidden lg:flex" aria-label={`${section.name} menu`}>
              {nav.map((n) => (
                <Link
                  key={n.label}
                  href={n.href}
                  onMouseEnter={() => (n.tab ? openMega(n.tab) : scheduleClose())}
                  onFocus={() => n.tab && openMega(n.tab)}
                  onClick={(e) => {
                    if (n.tab) {
                      if (mega && isOn(n)) {
                        e.preventDefault();
                        setMega(false);
                      } else {
                        e.preventDefault();
                        openMega(n.tab);
                      }
                    }
                  }}
                  aria-expanded={n.tab ? mega && isOn(n) : undefined}
                  className={cn(
                    "flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-[14.5px] font-medium transition cursor-pointer",
                    n.tab && mega && isOn(n) ? "bg-white/70 text-ink shadow-sm" : "text-ink/80 hover:bg-white/70 hover:text-ink",
                    n.className,
                  )}
                >
                  {n.label === "Your Photo" && <ImagePlus size={15} className="text-accent-2" />}
                  {n.label}
                  {n.badge && <span className="rounded-full bg-gradient-to-r from-[#7c3aed] to-[#e11d74] px-1.5 py-px text-[9.5px] font-bold uppercase text-white">{n.badge}</span>}
                  {n.tab && <ChevronDown size={14} className={cn("transition", mega && isOn(n) && "rotate-180")} />}
                </Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-1 lg:ml-auto" onMouseEnter={scheduleClose}>
              <SectionSwitch current={section.slug} className="mr-1 hidden lg:flex" />
              <button
                onClick={() => setSearch(true)}
                className="hidden h-10 items-center gap-2 whitespace-nowrap rounded-full bg-white/60 pl-3 pr-4 text-[13.5px] text-muted transition hover:bg-white md:flex lg:w-10 lg:justify-center lg:p-0"
                aria-label="Search"
              >
                <Search size={17} /> <span className="lg:hidden">{gadgets ? "Search gadgets…" : "Search your phone…"}</span>
              </button>
              <button onClick={() => setSearch(true)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/70 md:hidden" aria-label="Search">
                <Search size={20} />
              </button>
              <ThemeToggle />
              <Link href="/account" className="hidden h-10 w-10 place-items-center rounded-full hover:bg-white/70 sm:grid" aria-label={user ? "My account" : "Log in"}>
                <User size={20} />
              </Link>
              <button onClick={() => openCart(true)} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-white/70" aria-label={`Cart, ${count} items`}>
                <ShoppingBag size={20} />
                {count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white shadow">{count}</span>
                )}
              </button>
            </div>
          </div>

          {/* mobile: compact shop switcher, folds away while scrolling */}
          <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 lg:hidden", scrolled ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100")}>
            <div className="min-h-0 overflow-hidden">
              <div className="grid grid-cols-4 gap-1 pb-2.5">
                {CATEGORIES.map((c) => {
                  const on = c.slug === section.slug;
                  return (
                    <Link
                      key={c.slug}
                      href={c.home}
                      tabIndex={scrolled ? -1 : undefined}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "flex h-9 min-w-0 items-center justify-center gap-[3px] rounded-full px-0.5 text-[11.5px] font-semibold tracking-[-0.01em] transition",
                        on
                          ? "bg-ink text-white dark:bg-white dark:text-neutral-950 font-bold shadow-md"
                          : "bg-white/55 text-ink/70 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/20",
                      )}
                    >
                      <SectionIcon slug={c.slug} size={13} className={cn("shrink-0", on ? "text-white dark:text-neutral-950" : "text-ink/70 dark:text-neutral-300")} />
                      <span className="truncate">{c.short}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* the crystal panel — grows out of the header pill */}
          <div className={cn("hidden transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] lg:grid", mega ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
            <div className="min-h-0">
              <div className="border-t border-white/60">
                {gadgets ? (
                  mega && <GadgetMegaPanel tab={tab} setTab={setTab} onNavigate={() => setMega(false)} />
                ) : (
                  brands.length > 0 && <MegaPanel brands={brands} category={section} tab={tab} setTab={setTab} onNavigate={() => setMega(false)} />
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* mobile menu sheet */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", menu ? "pointer-events-auto" : "pointer-events-none")}>
        <div className={cn("absolute inset-0 bg-black/25 transition-opacity", menu ? "opacity-100" : "opacity-0")} onClick={() => setMenu(false)} />
        <aside
          className={cn(
            "crystal absolute bottom-3 left-3 top-3 flex w-[86%] max-w-[360px] flex-col overflow-hidden rounded-[28px] transition-transform duration-300",
            menu ? "translate-x-0" : "-translate-x-[110%]",
          )}
        >
          <div className="flex items-center justify-between p-5 pb-3">
            <Logo section={section} />
            <button className="grid h-10 w-10 place-items-center rounded-full bg-white/70" onClick={() => setMenu(false)} aria-label="Close menu">
              <X size={19} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 pb-3">
            {/* other shops */}
            <div className="mb-3 grid grid-cols-4 gap-1 rounded-2xl bg-white/50 p-1" aria-label="Switch shop">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={c.home}
                  aria-current={section.slug === c.slug ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl py-2 text-[11.5px] font-semibold transition",
                    section.slug === c.slug ? "bg-white shadow-sm" : "text-ink/60",
                  )}
                >
                  <SectionIcon slug={c.slug} size={17} /> {c.short}
                </Link>
              ))}
            </div>

            {gadgets ? (
              <div className="grid grid-cols-2 gap-2 px-1 pb-2">
                {section.styles.map((s) => (
                  <Link key={s.cat} href={`/shop?category=${s.cat}`} className="flex flex-col items-center rounded-2xl bg-white/55 p-3 text-center">
                    <GadgetThumb material={s.id} color={s.color} accent={s.accent} className="h-14 w-14" />
                    <span className="mt-1 text-[13.5px] font-bold">{s.name}</span>
                    <span className="text-[11.5px] text-muted">{s.hint}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <>
                {section.slug === "skins" && (
                  <Link href="/product/custom-photo-skin" className="mb-2 flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#eef1ff] to-[#fdeaf4] px-4 py-3 text-[14px] font-semibold">
                    📷 Custom photo skin <ChevronRight size={16} />
                  </Link>
                )}
                {brands.map((b) => {
                  const open = mobileBrand === b.slug;
                  return (
                    <div key={b.slug} className="mb-1">
                      <button
                        onClick={() => setMobileBrand(open ? null : b.slug)}
                        className={cn("flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-[16px] font-semibold", open ? "bg-white/70" : "hover:bg-white/50")}
                        aria-expanded={open}
                      >
                        {b.name} {section.short.toLowerCase()} <ChevronDown size={17} className={cn("text-muted transition", open && "rotate-180")} />
                      </button>
                      <div className={cn("grid transition-[grid-template-rows] duration-300", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                        <div className="min-h-0 overflow-hidden">
                          <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-2">
                            {b.models.map((m) => (
                              <Link key={m.slug} href={`/shop?category=${section.slug}&model=${m.slug}`} className="chip h-8 bg-white/70 text-[13px]">
                                {shortModel(m.name)}
                              </Link>
                            ))}
                            <Link href={`/shop?category=${section.slug}&brand=${b.slug}`} className="chip h-8 text-[13px] font-semibold text-accent">All →</Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">{section.stylesLabel}</p>
                <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                  {section.styles.map((m) => (
                    <Link key={m.id} href={m.id === "skin-custom" ? "/product/custom-photo-skin" : `/shop?category=${section.slug}&material=${m.id}`} className="chip h-8 bg-white/60 text-[13px]">
                      <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: m.color }} /> {m.name}
                    </Link>
                  ))}
                </div>
              </>
            )}
            {[
              [`/shop?category=${section.slug}`, `All ${section.noun}`],
              ["/track", "Track order"],
              ["/account", user ? `Hi, ${user.name.split(" ")[0]} — My account` : "Log in / Sign up"],
            ].map(([h, l]) => (
              <Link key={h} href={h} className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-[16px] font-medium hover:bg-white/60">
                {l} <ChevronRight size={17} className="text-muted" />
              </Link>
            ))}
          </nav>
          <div className="m-3 rounded-2xl bg-white/60 p-4 text-sm text-muted">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <Truck size={16} /> Cash on Delivery
            </div>
            Pay when your order arrives — anywhere in Pakistan.
          </div>
        </aside>
      </div>

      <SearchOverlay open={search} onClose={() => setSearch(false)} section={section} />
    </>
  );
}
