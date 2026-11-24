import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Source Sans 3: a free font by Adobe, standing in for Adobe Clean.
const sans = localFont({
  src: "../public/fonts/source-sans-3.woff2",
  weight: "400 900",
  variable: "--font-source",
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
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
