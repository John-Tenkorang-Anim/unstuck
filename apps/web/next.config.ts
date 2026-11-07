import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspace,
  turbopack: { root: workspace },
  poweredByHeader: false,
  devIndicators: false,
};
export default config;
