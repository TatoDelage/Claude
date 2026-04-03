"use client";

import dynamic from "next/dynamic";

const Round2Content = dynamic(() => import("./_content"), { ssr: false });

export default function Round2Page() {
  return <Round2Content />;
}
