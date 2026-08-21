import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { getArtistEnrichmentState, runArtistEnrichment } from "@/lib/server/artistEnrichmentState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertMusicAdmin(request);
    const artistId = new URL(request.url).searchParams.get("artistId")?.trim() ?? "";
    if (!artistId) return Response.json({ error: "Falta artistId" }, { status: 400 });

    const state = await getArtistEnrichmentState(artistId);
    return Response.json({ state });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Error leyendo el estado del enriquecimiento";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { artistId?: string };
    const artistId = body.artistId?.trim() ?? "";
    if (!artistId) return Response.json({ error: "Falta artistId" }, { status: 400 });

    const state = await runArtistEnrichment(artistId);
    return Response.json({ state, result: state.result });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Error enriqueciendo el artista";
    return Response.json({ error: message }, { status: 500 });
  }
}
