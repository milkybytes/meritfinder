import type { MetadataRoute } from "next";

import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic"; // read MERITFINDER_SITE_URL when asked, not once at build time

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/*?", "/api/"] }, sitemap: `${getConfig().siteUrl}/sitemap.xml` };
}
