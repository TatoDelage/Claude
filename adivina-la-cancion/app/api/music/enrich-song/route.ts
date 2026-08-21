import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { getSongEnrichmentState, runSongEnrichment } from "@/lib/server/songEnrichmentState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertMusicAdmin(request);
    const songId = new URL(request.url).searchParams.get("songId")?.trim() ?? "";
    if (!songId) return Response.json({ error: "Falta songId" }, { status: 400 });
    const state = await getSongEnrichmentState(songId);
    return Response.json({ state });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) return Response.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Error consultando enriquecimiento de canción";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { songId?: string };
    const songId = body.songId?.trim() ?? "";
    if (!songId) return Response.json({ error: "Falta songId" }, { status: 400 });
    const state = await runSongEnrichment(songId);
    return Response.json({ state, result: state.result });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) return Response.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Error enriqueciendo la canción";
    return Response.json({ error: message }, { status: 500 });
  }
}
