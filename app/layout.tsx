import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { AppFooter } from "@/app/components/AppFooter";
import { AppHeader } from "@/app/components/AppHeader";
import "./styles.css";

const jetBrainsMono = JetBrains_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-jetbrains"
});

export const metadata: Metadata = {
  title: "imagent arena",
  description: "Image agent playground and benchmark leaderboard",
  icons: {
    icon: "/brand/imagent-ai-avatar.jpg",
    apple: "/brand/imagent-ai-avatar.jpg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={jetBrainsMono.variable}>
        <AppHeader />
        <main>{children}</main>
        <AppFooter />
      </body>
    </html>
  );
}
