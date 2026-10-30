import type { MetadataRoute } from "next";
import { guides } from "@/content/guides";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/guides", "/privacy", ...guides.map((g) => `/guides/${g.slug}`)].map((p) => ({ url: `${site.url}${p}` }));
}
