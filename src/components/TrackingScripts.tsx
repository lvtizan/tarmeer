import Script from "next/script";
import type { CountryCode } from "@/lib/country";

/**
 * Third-party marketing/analytics trackers restored from the pre-Next.js site
 * (originally inline in the old Vite build's index.html). Rendered once in the
 * root layout, in production only, AND only on the AE site.
 *
 * COUNTRY SCOPING (国家隔离): these are the UAE-specific accounts — the GA4
 * stream "迪拜建材城" is bound to https://www.tarmeer.com, and the GTM / Meta /
 * TikTok pixels belong to the same AE marketing accounts. They MUST NOT fire on
 * vn.tarmeer.com (or any future non-AE site), or Vietnam traffic pollutes the
 * UAE analytics/ad data. When a new country gets its own accounts, add its IDs
 * and broaden the gate — do not just remove it.
 *
 * These are the canonical tarmeer.com accounts — do NOT change the IDs without
 * confirming with the marketing owner. Snippets are the vendors' official
 * loaders, kept verbatim so behaviour matches the original site.
 *
 * Known limitation: in this SPA, client-side route changes do NOT re-fire a
 * PageView for GA4 / Meta / TikTok (only the initial document load does), the
 * same as any stock pixel install. SPA route-change tracking is a separate,
 * deliberate follow-up — not part of this restore.
 */

const GTM_ID = "GTM-NLB9VWLM";
const GA4_ID = "G-KRXL45QLMB";
const META_PIXEL_IDS = ["1435092104500532", "1866475261423119"] as const;
const TIKTOK_PIXEL_ID = "D7CRM0RC77UEG1PVEUKG";

interface TrackingScriptsProps {
  /** Resolved country code (from x-country / getCountry) of the current request. */
  country: CountryCode;
}

export default function TrackingScripts({ country }: TrackingScriptsProps) {
  // Skip trackers during local development (`next dev`) so dev traffic never
  // hits the marketing analytics. Note: NODE_ENV is "production" for any
  // `next build` output, so this does NOT distinguish a staging/preview deploy
  // — this app has a single self-hosted production target, so that's fine. If a
  // separate staging env is ever added, gate on a dedicated env var instead.
  if (process.env.NODE_ENV !== "production") return null;

  // These IDs are UAE-only; never fire them on other countries' sites.
  if (country !== "ae") return null;

  return (
    <>
      {/* Google Tag Manager */}
      <Script id="gtm-init" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
        />
      </noscript>

      {/* Google Analytics 4 */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4_ID}');`}
      </Script>

      {/* Meta Pixel (dual ID) */}
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_IDS[0]}');fbq('init','${META_PIXEL_IDS[1]}');fbq('track','PageView');`}
      </Script>

      {/* TikTok Pixel */}
      <Script id="tiktok-pixel" strategy="afterInteractive">
        {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript";n.async=!0;n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${TIKTOK_PIXEL_ID}');ttq.page();}(window,document,'ttq');`}
      </Script>
    </>
  );
}
