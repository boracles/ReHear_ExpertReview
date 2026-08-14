import type { Metadata } from "next";
import { AppRouter } from "./app-router";

export const metadata: Metadata = {
  title: "AI 청중 에이전트 백채널 디자인 프레임워크 | 전문가 검토",
  description:
    "VR 발표 훈련 환경에서의 AI 청중 에이전트 백채널 디자인 프레임워크 전문가 검토 초대",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function Home() {
  return <AppRouter />;
}
