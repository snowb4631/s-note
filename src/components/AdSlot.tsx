"use client";

import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({ client, slot }: { client: string; slot: string }) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // An ad failure must never affect sending.
    }
  }, []);

  return (
    <aside aria-label="광고" data-testid="ad-slot" className="mt-40 border-t border-rule pt-3">
      <p className="text-xs text-ink-soft mb-2">광고</p>
      <Script
        id="adsense"
        strategy="afterInteractive"
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      />
      <ins
        className="adsbygoogle"
        style={{ display: "block", minHeight: 100 }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
