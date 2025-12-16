import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { OfflineIndicator } from "@/components/common/OfflineIndicator";
import { ServiceWorkerRegistration } from "@/components/common/ServiceWorkerRegistration";
import AppVersionBadge from "@/components/common/AppVersionBadge";

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EduSync",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA meta tags */}
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="EduSync" />
        
        {/* Icons for PWA */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        
        {/* Preconnect to external resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-50 dark:bg-zinc-900`}
        suppressHydrationWarning
      >
        <ServiceWorkerRegistration />
        <OfflineIndicator />
        <AppVersionBadge />
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
