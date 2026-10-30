"use client";

import Script from "next/script";

/** The only place the AdSense script is loaded from. */
export function AdScript({ client }: { client: string }) {
  return (
    <Script
      id="adsense"
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
    />
  );
}
