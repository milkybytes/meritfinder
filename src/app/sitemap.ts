import type { MetadataRoute } from "next";

import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic"; // read MERITFINDER_SITE_URL when asked, not once at build time

// One interactive page; every filtered view is a query string that canonicalises back to it.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: getConfig().siteUrl, changeFrequency: "daily", priority: 1 }];
}
