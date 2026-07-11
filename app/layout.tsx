import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://winnersbookmark.com"),
  title: {
    default:
      "Winnersbookmark Daily Blogs — Daily Discipline. Strategic Growth. Built for Winners.",
    template: "%s | Winnersbookmark Daily Blogs",
  },
  description:
    "New knowledge every day. A stronger man every month. Daily blogs, book wisdom, mentor lessons, fitness systems, nutrition guidance, money habits, AI productivity, and discipline challenges for men who are serious about growth. By Keith Warren / Winners Bookmark Incorporated.",
  keywords: [
    "men's self-improvement",
    "discipline",
    "daily blog",
    "fitness for men",
    "money habits",
    "book summaries",
    "mentorship",
    "Winners Bookmark",
    "Keith Warren",
  ],
  openGraph: {
    title: "Winnersbookmark Daily Blogs",
    description:
      "New Knowledge Every Day. A Stronger Man Every Month. Built for Winners.",
    type: "website",
    siteName: "Winnersbookmark Daily Blogs",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
