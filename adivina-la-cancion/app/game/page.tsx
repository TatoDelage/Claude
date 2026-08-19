"use client";
// Game page — depends entirely on client-side localStorage.
// Skip SSR to avoid hydration mismatches.
import dynamic from "next/dynamic";
import RoomCodeBadge from "@/components/RoomCodeBadge";

const GameContent = dynamic(() => import("./_content"), {
  ssr: false,
  loading: () => null,
});

export default function GamePage() {
  return (
    <>
      <GameContent />
      <RoomCodeBadge />
    </>
  );
}
