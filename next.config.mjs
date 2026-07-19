/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages 直接发布 out/ 目录；Vercel 仍可作为备用部署。
  output: "export",
  trailingSlash: true,
  images: {
    // 静态导出没有 Next.js 图片处理服务，图片优化由现有 WebP/CDN 参数完成。
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "i0.hdslb.com" },
      { protocol: "https", hostname: "i1.hdslb.com" },
      { protocol: "https", hostname: "i2.hdslb.com" },
    ],
  },
};

export default nextConfig;
