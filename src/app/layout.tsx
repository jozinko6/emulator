import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AppShell } from "@/components/layout/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displayFont = Press_Start_2P({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jaňo še chce bavkac — Lokálny emulátor hier",
  description:
    "Lokálne orientovaný online emulátor a správca vlastných záložných kópií hier pre DOS, PlayStation 1 a PlayStation 2. Hry zostávajú vo vašom zariadení. Funguje na PC, Androide a Android TV.",
  keywords: [
    "Jaňo še chce bavkac",
    "DOS emulator",
    "PlayStation 1",
    "PS1",
    "PS2",
    "js-dos",
    "EmulatorJS",
    "PWA",
    "OPFS",
    "Android",
    "Android TV",
  ],
  authors: [{ name: "Jaňo še chce bavkac" }],
  applicationName: "Jaňo še chce bavkac",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Jaňo še chce bavkac",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Jaňo še chce bavkac",
    description: "Emulátor vlastných DOS a PlayStation hier pre PC, Android a Android TV.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} antialiased bg-background text-foreground`}
      >
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
