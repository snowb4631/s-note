"use client";

import { useEffect } from "react";
import { AdScript } from "./AdScript";

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
      <AdScript client={client} />
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
