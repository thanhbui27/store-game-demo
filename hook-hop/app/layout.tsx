import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Hook Hop — Móc lấy đà, bay thật xa";
const description =
  "Game một nút: giữ để móc dây, thả đúng nhịp để bay qua skyline hoàng hôn.";

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
      images: [
        {
          url: imageUrl,
          width: 1734,
          height: 907,
          alt: "Nhân vật Hook Hop đu qua các móc phát sáng trên skyline hoàng hôn",
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
