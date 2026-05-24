import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Playfair_Display } from "next/font/google";
import { ThemeScript } from "@/components/landing/theme-script";
import { Providers } from "@/components/wallet/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "taxee — After-tax DeFi portfolio agent",
  description:
    "The first DeFi portfolio agent that optimizes after-tax return — not gross performance. Cross-chain rebalance, harvest, and hold with tax awareness embedded in every decision.",
  icons: {
    icon: "/logo-mark.png",
    apple: "/logo-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${playfair.variable} font-sans antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
