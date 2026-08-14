export type ExpertiseTrack = "A" | "B" | "C" | "GENERAL";

export type ExpertProfile = {
  displayName: string;
  track: ExpertiseTrack;
  label: string;
  headline: string;
  reason: string;
  focusItems: readonly string[];
};

const TRACK_PROFILES: Readonly<Record<ExpertiseTrack, Omit<ExpertProfile, "displayName">>> = {
  A: {
    track: "A",
    label: "발표 · 커뮤니케이션",
    headline: "발표와 커뮤니케이션 관점의 검토를 부탁드립니다.",
    reason:
      "발표 수행과 비언어적 청중 반응이 발표자에게 어떻게 해석되는지 판단해주실 수 있는 전문성을 바탕으로 이번 검토를 의뢰드립니다.",
    focusItems: [
      "백채널이 발표 흐름과 수행 수준에 비추어 자연스럽고 적절한지",
      "같은 반응이 격려·평가·압박으로 다르게 해석될 가능성은 없는지",
      "발표 교육과 수행 피드백 맥락에서 실제로 활용할 수 있는지",
    ],
  },
  B: {
    track: "B",
    label: "HCI · Human–AI Interaction",
    headline: "Human–AI Interaction 관점의 검토를 부탁드립니다.",
    reason:
      "사용자가 AI 에이전트의 반응을 어떻게 이해하고 신뢰하는지, 수행정보와 반응의 연결이 일관되게 전달되는지 판단해주실 수 있어 이번 검토를 의뢰드립니다.",
    focusItems: [
      "수행정보–백채널 연동 규칙의 의미가 명확하고 일관적인지",
      "에이전트 반응이 사용자의 해석과 신뢰 형성에 미치는 영향은 적절한지",
      "평가적 반응의 강도·빈도·타이밍이 사용자 경험에 적합한지",
    ],
  },
  C: {
    track: "C",
    label: "XR · 가상 에이전트",
    headline: "XR과 가상 에이전트 관점의 검토를 부탁드립니다.",
    reason:
      "VR 환경에서 가상 에이전트의 비언어적 반응이 어떻게 지각되고 구현되는지에 대한 전문성을 바탕으로 이번 검토를 의뢰드립니다.",
    focusItems: [
      "VR 공간에서 시선·고개·표정·몸동작이 분명하게 지각되는지",
      "백채널 애니메이션의 조합과 타이밍이 자연스럽고 구현 가능한지",
      "다수 에이전트 운용 시 반복감·동기화·성능상의 문제는 없는지",
    ],
  },
  GENERAL: {
    track: "GENERAL",
    label: "관련 분야 전문가",
    headline: "전문가님의 관점에서 중점 검토를 부탁드립니다.",
    reason:
      "관련 분야에서 축적하신 연구·교육·실무 경험을 바탕으로 프레임워크의 적절성과 실제 활용 가능성을 검토해주시기를 부탁드립니다.",
    focusItems: [
      "각 규칙의 내용과 의미가 명확하고 일관적인지",
      "발표 훈련 맥락에서 AI 청중의 반응으로 적절한지",
      "실제 시스템에서 무리 없이 구현하고 활용할 수 있는지",
    ],
  },
};

/**
 * Actual participant names and fields are added only after the expert list is
 * confirmed. TEST-01 demonstrates the personalized A-track invitation.
 */
const PARTICIPANT_PROFILES: Readonly<Record<string, { displayName: string; track: ExpertiseTrack }>> = {
  "TEST-01": { displayName: "테스트 전문가님", track: "A" },
};

export function getExpertProfile(participantId: string): ExpertProfile {
  const participant = PARTICIPANT_PROFILES[participantId] ?? {
    displayName: "전문가님",
    track: "GENERAL" as const,
  };
  return { ...TRACK_PROFILES[participant.track], displayName: participant.displayName };
}
