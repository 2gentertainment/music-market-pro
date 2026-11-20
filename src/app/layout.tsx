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

export const metadata: Metadata = {
  title: "Music Market Pro",
  description: "Direct-to-fan platform for independent artists and labels",
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
