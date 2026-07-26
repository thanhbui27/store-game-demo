import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Thằn Lằn Săn Muỗi";
const description =
  "Ngắm, phóng lưỡi và tạo chuỗi combo trong khu vườn nhiệt đới về đêm.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "vi_VN",
      images: [
        {
          url: imageUrl,
          width: 1734,
          height: 907,
          alt: "Thằn lằn xanh phóng lưỡi săn muỗi vàng trong khu vườn đêm",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

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
