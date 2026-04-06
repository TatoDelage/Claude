"use client";

import dynamic from "next/dynamic";

const Round5Content = dynamic(() => import("./_content"), { ssr: false });

export default function Round5Page() {
  return <Round5Content />;
}
