"use client";
// Round 1 page — depends entirely on client-side localStorage.
// Skip SSR to avoid hydration mismatches.
import dynamic from "next/dynamic";

const Round1Content = dynamic(() => import("./_content"), {
  ssr: false,
  loading: () => null,
});

export default function Round1Page() {
  return <Round1Content />;
}
