import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://fanrenmap.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "凡人残图 · 天南寻迹图",
  description:
    "在天南舆图中探索《凡人修仙传》官方正片、UP 主解析与同人二创。",
  openGraph: {
    title: "凡人残图 · 天南寻迹图",
    description: "正道看正片，魔道听论道，天道盟赏二创。",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "凡人残图" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "凡人残图 · 天南寻迹图",
    description: "正道看正片，魔道听论道，天道盟赏二创。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preload" as="image" href="/tiannan-map-960.webp" type="image/webp" media="(max-width: 720px)" />
        <link rel="preload" as="image" href="/tiannan-map.webp" type="image/webp" media="(min-width: 721px)" />
        {/* 使用国内可访问的 Google Fonts 镜像，避免国内 CI/CD 构建机器访问被墙导致 build 超时 */}
        <link
          rel="preconnect"
          href="https://fonts.loli.net"
        />
        <link
          rel="preconnect"
          href="https://gstatic.loli.net"
          crossOrigin=""
        />
        <link
          href="https://fonts.loli.net/css2?family=Noto+Serif+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
