import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Bungee, Roboto } from "next/font/google";
import { Theme } from "@radix-ui/themes";
import "./globals.css";
import React, { Suspense } from "react";
import Loader from "@/components/Loader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bungee = Bungee({
  weight: "400",
  variable: "--font-bungee",
  subsets: ["latin"],
  display: "swap",
});

const roboto = Roboto({
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RadioHead",
  description: "Radio streaming application",
  icons: {
    icon: "/base.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bungee.variable} ${roboto.variable} antialiased`}
      >
        <Theme
          appearance="dark"
          accentColor="blue"
          radius="medium"
          panelBackground="solid"
          scaling="100%"
        >
          <div className="min-h-screen flex flex-col bg-main-gradient">
            <Suspense fallback={<Loader />}>{children}</Suspense>
          </div>
        </Theme>
      </body>
    </html>
  );
}
