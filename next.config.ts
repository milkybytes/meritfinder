import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Set by the Docker build (deploy/Dockerfile): copies just the files the server needs into .next/standalone, for a small image.
  // Left off otherwise, so `npm start` works as usual.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Next's response compression (a Gzip stream) was warning about drain listeners under heavy streaming.
  // Locally it doesn't matter; behind a real host the reverse proxy compresses.
  compress: false,
  poweredByHeader: false, // don't announce the framework
  // The few pictures are small and already sized; this also removes the /_next/image resizing endpoint, which
  // anyone could otherwise ask to spend CPU.
  images: { unoptimized: true },
  // Fixed headers only: these are baked in at build time. The ones that depend on the environment (HSTS, caching,
  // the Content Security Policy) are set per request in src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
