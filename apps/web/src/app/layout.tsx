import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FooterGate } from "@/components/FooterGate";
import { CartDrawer } from "@/components/CartDrawer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { RecentPurchase } from "@/components/RecentPurchase";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { LeadCaptureModal } from "@/components/LeadCaptureModal";
import { Suspense } from "react";
import { SITE_URL, STORE_NAME } from "@/lib/config";
import { Analytics } from "@/components/Analytics";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${STORE_NAME} — MagSafe Cases, Skins & Gadgets in 3D · Cash on Delivery`, template: `%s · ${STORE_NAME}` },
  description:
    "MagSafe-compatible cases for iPhone, Samsung Galaxy and Google Pixel. Pick your phone, see the case on it in 3D, pay cash on delivery anywhere in Pakistan.",
  openGraph: { type: "website", siteName: STORE_NAME, locale: "en_PK" },
  applicationName: STORE_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: STORE_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#eceef3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('mg_theme');
                if (t === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-dvh">
        <div className="ambient" aria-hidden />
        <Suspense fallback={<div className="h-[107px]" />}>
          <Header />
        </Suspense>
        <main className="mx-auto max-w-7xl px-3 pt-5 sm:px-5">{children}</main>
        <Suspense>
          <FooterGate>
            <Footer />
          </FooterGate>
        </Suspense>
        <Suspense>
          <CartDrawer />
          <WhatsAppButton />
          <RecentPurchase />
          <PwaInstallPrompt />
          <PushNotificationPrompt />
          <LeadCaptureModal />
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
