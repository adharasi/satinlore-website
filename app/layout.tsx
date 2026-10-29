import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Satinlore — Feel the story unfold",
  description: "Your stories. A new way to feel them. Your toy follows the story as you read. Just read, relax, and enjoy. Join the Satinlore list. Adults 18+.",
  metadataBase: new URL("https://satinlore.com"),
  openGraph: { title: "Satinlore — Feel the story unfold", description: "Your toy follows the story. Just read, relax, and enjoy. Coming soon.", type: "website" },
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
