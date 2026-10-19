import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Banner rendering reads these at runtime via fs, which the file tracer cannot see.
  outputFileTracingIncludes: {
    "/api/admin/banners": ["./assets/fonts/**/*", "./public/images/teams/**/*"],
  },
};

export default nextConfig;
