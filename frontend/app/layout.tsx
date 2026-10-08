import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { COLOR_SCHEME_SCRIPT } from "@/lib/colorSchemeScript";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Forms", template: "%s · Forms" },
  description: "Build conversational forms, share them, and review results.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the inline script before React hydrates (dark mode without a flash).
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
