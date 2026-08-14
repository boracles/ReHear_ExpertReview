"use client";

import { useEffect, useState } from "react";
import { ExpertInvitation } from "./expert-invitation";
import { ResearchDashboard } from "./research-dashboard";
import { UserStudy } from "./user-study";

type Route = { kind: "expert" } | { kind: "study"; token: string } | { kind: "research" };

function currentRoute(): Route {
  const study = window.location.hash.match(/^#\/study\/([A-Za-z0-9_-]{32,})$/);
  if (study) return { kind: "study", token: study[1] };
  if (window.location.hash === "#/research") return { kind: "research" };
  return { kind: "expert" };
}

export function AppRouter() {
  const [route, setRoute] = useState<Route | null>(null);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  if (!route) return null;
  if (route.kind === "study") return <UserStudy studyToken={route.token} />;
  if (route.kind === "research") return <ResearchDashboard />;
  return <ExpertInvitation />;
}
