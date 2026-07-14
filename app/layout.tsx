import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "凡人残图 · 道友寻番指南",
  description:
    "一张持续补全的《凡人修仙传》追番情报地图，自动整理正片、分集解析、人物专题与公开物料。",
  openGraph: {
    title: "凡人残图 · 每周一片，循迹入仙途",
    description: "正片、解析、人物与专题，一张残图全部寻到。",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "凡人残图" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "凡人残图 · 道友寻番指南",
    description: "正片、解析、人物与专题，一张残图全部寻到。",
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
