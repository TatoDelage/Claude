import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { searchSpotifyTracks } from "@/lib/server/spotifyCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { title?: string; artist?: string };
    const title = body.title?.trim() ?? "";
    if (title.length < 2) return Response.json({ error: "Escribe al menos 2 caracteres" }, { status: 400 });

    const results = await searchSpotifyTracks(title, body.artist);
    return Response.json({ results });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Error buscando en Spotify";
    return Response.json({ error: message }, { status: 500 });
  }
}
