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
