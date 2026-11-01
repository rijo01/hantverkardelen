import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  /**
   * Kommun × yrke är ISR och får därför inte läsa searchParams. ?page=N skrivs
   * om till den interna vägen /sida/N (en egen ISR-route) — den publika
   * adressen ändras inte. beforeFiles: omskrivningen måste gälla före den
   * dynamiska routen, som annars matchar först. Se BranschSida.tsx.
   */
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/kommun/:slug/:bransch",
          has: [{ type: "query", key: "page", value: "(?<sida>\\d{1,4})" }],
          destination: "/kommun/:slug/:bransch/sida/:sida",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
