"use client";

import { useEffect } from "react";
import { AdScript } from "./AdScript";
import { AdSlot } from "./AdSlot";

export function GuideAds({ client, slot }: { client: string; slot: string | null }) {
  // A loaded script survives client-side navigation, and the editor must not run it. So leaving
  // the guides for any other path drops the script with a full load. The URL has already changed
  // when this cleanup runs; moving between guide pages, and Strict Mode's rerun, stay on /guides.
  useEffect(
    () => () => {
      if (!/^\/guides(\/|$)/.test(window.location.pathname)) window.location.reload();
    },
    [],
  );

  return slot ? <AdSlot client={client} slot={slot} /> : <AdScript client={client} />;
}
