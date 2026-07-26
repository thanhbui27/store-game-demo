import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "R/ARCADE — Chọn game, chơi ngay",
    template: "%s · R/ARCADE",
  },
  description:
    "Một góc arcade nhỏ để mở và chơi toàn bộ game trong bộ sưu tập.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
