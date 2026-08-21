import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { verifyInstrumentFact } from "@/lib/server/instrumentFactVerification";
import { supportedCanonicalInstruments, type CanonicalInstrument } from "@/lib/instrumentTaxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { songId?: string; instrument?: string };
    const songId = body.songId?.trim() ?? "";
    const instrument = body.instrument?.trim() ?? "";
    if (!songId) return Response.json({ error: "Falta songId" }, { status: 400 });
    if (!supportedCanonicalInstruments().includes(instrument as CanonicalInstrument)) {
      return Response.json({ error: "Instrumento no soportado" }, { status: 400 });
    }
    const result = await verifyInstrumentFact(songId, instrument as CanonicalInstrument);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Error verificando instrumento";
    return Response.json({ error: message }, { status: 500 });
  }
}
