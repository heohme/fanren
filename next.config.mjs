/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i0.hdslb.com" },
      { protocol: "https", hostname: "i1.hdslb.com" },
      { protocol: "https", hostname: "i2.hdslb.com" },
    ],
  },
};

export default nextConfig;
