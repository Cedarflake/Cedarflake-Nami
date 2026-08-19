import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getLocale } from "next-intl/server";

import { resolveAppLocale } from "@/i18n/routing";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "nami Config Console",
  description: "Manage redirects.json via WebUI",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nocache: true,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = resolveAppLocale(await getLocale());

  return (
    <html lang={locale}>
      <body className={`${inter.variable} antialiased font-sans`}>
        {children}
      </body>
    </html>
  );
}
