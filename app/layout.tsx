import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const vend = localFont({
  src: "../public/fonts/vend-sans.woff2",
  weight: "400 700",
  variable: "--font-vend",
  display: "swap",
});

const mono = localFont({
  src: "../public/fonts/jetbrains-mono.woff2",
  weight: "400 500",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agentic Sales Team",
  description: "An AI sales team that works for you in chat.",
  icons: { icon: "/logo-mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${vend.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
