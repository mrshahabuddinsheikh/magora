"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { api } from "@/lib/client-api";
import type { MarketingSettings } from "@/lib/types";

/**
 * Loads marketing pixels & analytics after the page is idle.
 * Fully configurable via Admin ➔ Marketing & Pixels Hub.
 * Zero performance impact on Core Web Vitals (CWV).
 */
export function Analytics() {
  const [settings, setSettings] = useState<MarketingSettings | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ data: MarketingSettings }>("/marketing-settings", { auth: false })
      .then((res) => {
        if (alive && res?.data) {
          setSettings(res.data);
          // If Google Search Console verification code is present and not yet in DOM, inject it
          const gsc = res.data.googleSearchConsoleCode?.trim();
          if (gsc) {
            let metaTag = document.querySelector('meta[name="google-site-verification"]');
            if (!metaTag) {
              metaTag = document.createElement("meta");
              metaTag.setAttribute("name", "google-site-verification");
              // Extract content if full tag was pasted
              const match = gsc.match(/content=["']([^"']+)["']/i);
              metaTag.setAttribute("content", match ? match[1] : gsc);
              document.head.appendChild(metaTag);
            }
          }
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  const metaPixel = settings?.metaPixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const tiktokPixel = settings?.tiktokPixelId;
  const googleTag = settings?.googleTagId || process.env.NEXT_PUBLIC_GA_ID;
  const enabled = settings ? settings.enabled : true;

  if (!enabled) return null;

  return (
    <>
      {/* 1. Google Analytics 4 & Google Ads */}
      {googleTag && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleTag}`}
            strategy="lazyOnload"
          />
          <Script id="ga4-script" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${googleTag}');
            `}
          </Script>
        </>
      )}

      {/* 2. Meta (Facebook/Instagram) Pixel */}
      {metaPixel && (
        <Script id="meta-pixel-script" strategy="lazyOnload">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixel}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {/* 3. TikTok Ads Pixel */}
      {tiktokPixel && (
        <Script id="tiktok-pixel-script" strategy="lazyOnload">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
              var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var a=document.createElement("script")
              ;a.type="text/javascript",a.async=!0,a.src=r+"?sdkid="+e+"&lib="+t;var c=document.getElementsByTagName("script")[0];c.parentNode.insertBefore(a,c)};
              ttq.load('${tiktokPixel}');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
      )}
    </>
  );
}
