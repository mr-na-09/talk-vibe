import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PresenceTracker } from "@/components/presence-tracker";
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
  title: "TalkVibe",
  description: "A premium messaging platform built for modern connection and secure conversations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-950 text-slate-50">
        <PresenceTracker />
        {children}
      </body>
    </html>
  );
}
