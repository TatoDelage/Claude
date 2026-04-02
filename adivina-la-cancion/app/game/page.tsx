"use client";
// Game page — depends entirely on client-side localStorage.
// Skip SSR to avoid hydration mismatches.
import dynamic from "next/dynamic";

const GameContent = dynamic(() => import("./_content"), {
  ssr: false,
  loading: () => null,
});

export default function GamePage() {
  return <GameContent />;
}
