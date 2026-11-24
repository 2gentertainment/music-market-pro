import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import DevSuiteBar from "@/components/DevSuiteBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DEFAULT_OG_IMAGE =
  "https://27593217-482041110881488807.preview.editmysite.com/uploads/2/7/5/9/27593217/youtube-banner-music-market-01-artboard-1_orig.jpg";

export const metadata: Metadata = {
  metadataBase: new URL("https://musicmarket.app"),
  title: "Music Market Pro",
  description: "Direct-to-fan platform for independent artists and labels",
  openGraph: {
    title: "Music Market Pro",
    description: "Direct-to-fan platform for independent artists and labels",
    siteName: "Music Market Pro",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        alt: "Music Market Pro",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Music Market Pro",
    description: "Direct-to-fan platform for independent artists and labels",
    images: [DEFAULT_OG_IMAGE],
  },
};

const showDevSuite =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_SUITE === "true";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#121212] text-white">
        {showDevSuite && <DevSuiteBar />}
        {children}
      </body>
    </html>
  );
}
