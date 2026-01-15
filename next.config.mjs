/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production"

const nextConfig = {
  output: "export",

  // REQUIRED for GitHub Pages
  trailingSlash: true,

  basePath: isProd ? "/gpredict" : "",
  assetPrefix: isProd ? "/gpredict/" : "",

  images: {
    unoptimized: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
