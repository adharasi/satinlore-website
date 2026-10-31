import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SatinLore — Read the story. Feel every turn.",
  description: "An adult reading app that syncs your compatible sex toy with your story and reading pace. Join for paid beta testing or free early access. Adults 18+.",
  metadataBase: new URL("https://satinlore.com"),
  openGraph: { title: "SatinLore — Read the story. Feel every turn.", description: "Upload your story. Feel its changing intensity and rhythms as you read. Join for paid beta testing or free early access. Adults 18+.", type: "website" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
