import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { OfflineIndicator } from "@/components/common/OfflineIndicator";

// Optimize fonts with font-display: swap for faster initial render
// font-display: swap allows fallback font to display immediately
// while custom font loads in the background (FOUT strategy)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Show system font immediately, swap when custom font loads
  preload: true, // Preload font file during build
  fallback: ["system-ui", "-apple-system", "sans-serif"], // Fallback fonts
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["monospace"],
});

export const metadata: Metadata = {
  title: "EduSync",
  description:
    "Hệ thống hỗ trợ quản lý phong trào và thi đua dành cho học sinh THPT",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-50 dark:bg-zinc-900`}
        suppressHydrationWarning
      >
        <OfflineIndicator />
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
