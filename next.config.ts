import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io", pathname: "/football/teams/**" },
      { protocol: "https", hostname: "assets-fantasy.llt-services.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
