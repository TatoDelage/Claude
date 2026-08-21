import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { ingestSpotifyTrackById } from "@/lib/server/musicIngestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { spotifyId?: string };
    const spotifyId = body.spotifyId?.trim() ?? "";
    if (!spotifyId) return Response.json({ error: "Falta spotifyId" }, { status: 400 });

    const result = await ingestSpotifyTrackById(spotifyId);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Error importando la canción";
    return Response.json({ error: message }, { status: 500 });
  }
}
