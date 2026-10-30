import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// El .env del proyecto vive en la raíz del repositorio (ver .env.example): de ahí sale VITE_API_URL.
loadEnvConfig(path.resolve(process.cwd(), "../.."));

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    VITE_API_URL: process.env.VITE_API_URL ?? "http://localhost:8000",
  },
};

export default nextConfig;
