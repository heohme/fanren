/** @type {import('next').NextConfig} */
const nextConfig = {
  // CloudBase 静态网站托管直接发布 out/ 目录。
  // Vercel 也支持该静态导出配置，因此两套部署可以同时保留。
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
