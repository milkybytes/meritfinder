import type { Metadata } from "next";
import { Barlow, Chakra_Petch, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";

import { THEME_STORAGE_KEY, themeMap } from "@/data/powers";
import { getConfig } from "@/lib/config";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/site";

import "./globals.css";

// Chakra Petch: angular, instrument-panel feel for headings and labels.
// Barlow: readable body text. JetBrains Mono: figures (prices, tonnage, distances).
const display = Chakra_Petch({ variable: "--font-display", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const sans = Barlow({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

// A function, not an object, so the address is read from the environment at request time.
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(getConfig().siteUrl),
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    keywords: ["Elite Dangerous", "Powerplay", "Powerplay 2.0", "merits", "mining", "Odyssey", "EDDN"],
    // Every filtered view (a query string) points back at the home page, so they count as one page.
    alternates: { canonical: "/" },
    openGraph: { type: "website", siteName: SITE_NAME, title: SITE_TITLE, description: SITE_DESCRIPTION, url: "/" },
    twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  };
}

const structuredData = () => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: getConfig().siteUrl,
  description: SITE_DESCRIPTION,
  applicationCategory: "GameApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
});

// Applies the saved colour theme before first paint so there is no flash of the default theme.
const applyTheme = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var m=${JSON.stringify(themeMap())};if(t&&m[t]){var s=document.documentElement.style;s.setProperty("--hue",m[t].hue);s.setProperty("--accent",m[t].accent)}}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The proxy gives every page request a nonce (see proxy.ts); the Content Security Policy only lets scripts with it run.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: applyTheme }} />
      </head>
      <body className="min-h-full">
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }} />
        {children}
      </body>
    </html>
  );
}
