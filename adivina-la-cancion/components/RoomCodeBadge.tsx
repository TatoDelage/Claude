"use client";

import { useEffect, useState } from "react";

export default function RoomCodeBadge() {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    setCode(localStorage.getItem("adivina_join_code"));
  }, []);

  if (!code) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 rounded-2xl border border-emerald-500/30 bg-canvas-900/95 px-4 py-3 shadow-xl backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Código de sala</p>
      <p className="text-xl font-black tracking-[0.2em] text-emerald-400">{code}</p>
      <p className="mt-1 text-[10px] text-zinc-600">Unirse: /join</p>
    </div>
  );
}
