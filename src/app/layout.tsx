import type { Metadata } from "next";
import { Outfit, Newsreader, Geist_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://designprep-canvas.vercel.app"),
  title: "DesignPrep Canvas — CEED / UCEED / NID / NIFT Study Studio",
  description: "Official design entrance papers, verified detailed solutions, interactive OMR, drawing canvas, and 32 masterclass design books.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "DesignPrep Canvas — CEED / UCEED / NID / NIFT Study Studio",
    description: "Official design entrance papers, verified detailed solutions, interactive OMR, drawing canvas, and 32 masterclass design books.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "DesignPrep Canvas Studio and Library",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DesignPrep Canvas — CEED / UCEED / NID / NIFT Study Studio",
    description: "Official design entrance papers, verified detailed solutions, interactive OMR, drawing canvas, and 32 masterclass design books.",
    images: ["/twitter-image.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${newsreader.variable} ${geistMono.variable} dark`} suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
