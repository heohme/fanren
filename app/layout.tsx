import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "凡人残图 · 修仙传更新追踪",
  description:
    "凡人修仙传新一季更新追踪 · 官方剧集与解析 UP 主聚合视图",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
