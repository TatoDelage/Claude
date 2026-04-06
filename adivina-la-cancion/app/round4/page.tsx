"use client";

import dynamic from "next/dynamic";

const Round4Content = dynamic(() => import("./_content"), { ssr: false });

export default function Round4Page() {
  return <Round4Content />;
}
