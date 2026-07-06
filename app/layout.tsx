import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kim Chi Mobile Shop",
  description: "Frontend MVP quản lý bán hàng, kho, sửa chữa và thu chi.",
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
