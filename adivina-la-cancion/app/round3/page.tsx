"use client";

import dynamic from "next/dynamic";

const Round3Content = dynamic(() => import("./_content"), { ssr: false });

export default function Round3Page() {
  return <Round3Content />;
}
