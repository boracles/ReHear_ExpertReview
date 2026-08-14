import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://boracles.github.io/ReHear_ExpertReview/"),
  title: {
    default: "ReHear · 전문가 검토",
    template: "%s · ReHear",
  },
  description:
    "VR 발표 훈련을 위한 AI 청중 에이전트 백채널 디자인 프레임워크 전문가 검토 초대",
  applicationName: "ReHear Expert Review",
  authors: [{ name: "윤보라" }],
  creator: "서울대학교 디자인학부 윤보라",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: "ReHear · AI 청중 에이전트 전문가 검토",
    description: "AI 청중 에이전트의 반응 설계를 전문가의 관점으로 검토해주세요.",
    images: [
      {
        url: "https://boracles.github.io/ReHear_ExpertReview/og.png",
        width: 1440,
        height: 756,
        alt: "Re:hear Expert Review — AI Audience Backchannel Design",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ReHear · AI 청중 에이전트 전문가 검토",
    description: "AI 청중 에이전트의 반응 설계를 전문가의 관점으로 검토해주세요.",
    images: ["https://boracles.github.io/ReHear_ExpertReview/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#02073d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
