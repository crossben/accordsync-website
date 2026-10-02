import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static: the build produces `out/`, any static host can serve it
  // (website.md section 1). No server, no API routes, no runtime data fetching.
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
