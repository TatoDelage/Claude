"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getRemoteRoomByCode } from "@/lib/supabaseRest";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      setError("Introduce un código de 6 caracteres");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const room = await getRemoteRoomByCode(normalized);
      if (!room) {
        setError("No existe ninguna partida con ese código");
        setLoading(false);
        return;
      }
      router.push(`/room/${normalized}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar la partida");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-canvas-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🎵</div>
          <h1 className="text-3xl font-black">Unirse a partida</h1>
          <p className="text-zinc-500 text-sm mt-2">Introduce el código que aparece en el dispositivo del presentador.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="ABC123"
            autoCapitalize="characters"
            autoCorrect="off"
            inputMode="text"
            className="w-full bg-canvas-900 border border-canvas-700 rounded-2xl px-4 py-4 text-center text-3xl font-black tracking-[0.35em] text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-500"
          />

          {error && <p className="text-sm text-rose-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-white text-zinc-900 font-black text-lg disabled:opacity-50 active:scale-95 transition-all"
          >
            {loading ? "Buscando…" : "Entrar en la partida"}
          </button>
        </form>

        <button
          onClick={() => router.push("/")}
          className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Volver
        </button>
      </div>
    </main>
  );
}
