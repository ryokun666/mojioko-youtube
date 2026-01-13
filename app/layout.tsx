import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://mojiokokun.vercel.app";

export const metadata: Metadata = {
  title: "モジオコYouTube | 完全無料のYouTube文字起こし・字幕取得ツール",
  description:
    "YouTube動画の文字起こしを完全無料で取得できるツール。URLを入力するだけで自動字幕・手動字幕をテキスト化。登録不要・広告なしで簡単にコピー可能。",
  keywords: [
    "YouTube",
    "文字起こし",
    "字幕",
    "無料",
    "テキスト化",
    "自動字幕",
    "コピー",
    "YouTube字幕取得",
    "YouTube文字起こし",
    "字幕抽出",
    "動画文字起こし",
    "無料ツール",
  ],
  authors: [{ name: "モジオコYouTube" }],
  creator: "モジオコYouTube",
  publisher: "モジオコYouTube",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: siteUrl,
    siteName: "モジオコYouTube",
    title: "モジオコYouTube | 完全無料のYouTube文字起こし・字幕取得ツール",
    description:
      "YouTube動画の文字起こしを完全無料で取得できるツール。URLを入力するだけで自動字幕・手動字幕をテキスト化。登録不要・広告なしで簡単にコピー可能。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "モジオコYouTube - 完全無料のYouTube文字起こしツール",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "モジオコYouTube | 完全無料のYouTube文字起こし・字幕取得ツール",
    description:
      "YouTube動画の文字起こしを完全無料で取得できるツール。URLを入力するだけで自動字幕・手動字幕をテキスト化。登録不要・広告なしで簡単にコピー可能。",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: siteUrl,
  },
  metadataBase: new URL(siteUrl),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "モジオコYouTube",
    description:
      "YouTube動画の文字起こしを完全無料で取得できるツール。URLを入力するだけで自動字幕・手動字幕をテキスト化。",
    url: siteUrl,
    applicationCategory: "UtilityApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "JPY",
    },
    featureList: [
      "完全無料",
      "登録不要",
      "広告なし",
      "自動字幕対応",
      "手動字幕対応",
      "ワンクリックコピー",
      "日本語対応",
      "多言語対応",
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: "1",
    },
  };

  return (
    <html lang="ja">
      <head>
        <Script
          src="https://cdn.lordicon.com/lordicon.js"
          strategy="beforeInteractive"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
