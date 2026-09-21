import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rivisk.dev"),
  title: {
    default: "Rivisk — Risk intelligence for Bitcoin capital on Stacks",
    template: "%s · Rivisk",
  },
  description:
    "Rivisk is a non-custodial risk intelligence layer for sBTC and Bitcoin-native finance on Stacks. Unified collateral health, liquidation distance, concentration, stress testing and verifiable on-chain risk attestations.",
  keywords: [
    "Stacks",
    "sBTC",
    "Bitcoin",
    "DeFi risk",
    "liquidation monitoring",
    "collateral health",
    "treasury analytics",
    "Zest Protocol",
  ],
  openGraph: {
    type: "website",
    title: "Rivisk — Risk intelligence for Bitcoin capital on Stacks",
    description:
      "Unified collateral health, liquidation distance, concentration, stress testing and verifiable on-chain risk attestations for Bitcoin capital on Stacks.",
    siteName: "Rivisk",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rivisk — Risk intelligence for Bitcoin capital on Stacks",
    description:
      "Non-custodial, deterministic risk analytics for sBTC and Stacks DeFi positions.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
