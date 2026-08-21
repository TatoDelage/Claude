import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { enrichArtist } from "@/lib/server/artistEnrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { artistId?: string };
    const artistId = body.artistId?.trim() ?? "";
    if (!artistId) return Response.json({ error: "Falta artistId" }, { status: 400 });

    const result = await enrichArtist(artistId);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Error enriqueciendo el artista";
    return Response.json({ error: message }, { status: 500 });
  }
}
