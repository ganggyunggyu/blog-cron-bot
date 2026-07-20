import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "노출지기 | 버튼 한 번으로 끝내는 노출체크",
    template: "%s | 노출지기",
  },
  description:
    "패키지, 일반건, 도그마루, 루트, 애견, 카페 노출체크를 한 번에 실행하고 진행률과 결과를 확인하세요.",
  keywords: ["노출지기", "네이버 노출체크", "블로그 노출체크", "카페 노출체크"],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "노출지기",
    title: "노출지기 | 복잡한 노출체크를 버튼 한 번으로",
    description: "여러 노출체크를 동시에 실행하고 진행률과 결과를 한눈에 확인하세요.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "노출지기" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "노출지기 | 버튼 한 번으로 끝내는 노출체크",
    description: "여러 노출체크를 동시에 실행하고 진행률과 결과를 한눈에 확인하세요.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
