import { after } from "next/server";
import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { ingestSpotifyTrackById } from "@/lib/server/musicIngestion";
import { runArtistEnrichmentIfNeeded } from "@/lib/server/artistEnrichmentState";
import { runSongEnrichmentIfNeeded } from "@/lib/server/songEnrichmentState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { spotifyId?: string };
    const spotifyId = body.spotifyId?.trim() ?? "";
    if (!spotifyId) return Response.json({ error: "Falta spotifyId" }, { status: 400 });

    const result = await ingestSpotifyTrackById(spotifyId);

    after(async () => {
      for (const artistId of result.artistIds) {
        try {
          await runArtistEnrichmentIfNeeded(artistId);
        } catch (error) {
          console.error(`Enriquecimiento automático de artista fallido para ${artistId}`, error);
        }
      }

      try {
        await runSongEnrichmentIfNeeded(result.songId);
      } catch (error) {
        console.error(`Enriquecimiento automático de canción fallido para ${result.songId}`, error);
      }
    });

    return Response.json({
      result,
      enrichmentScheduled: true,
      artistEnrichmentScheduled: result.artistIds.length > 0,
      songEnrichmentScheduled: true,
    });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Error importando la canción";
    return Response.json({ error: message }, { status: 500 });
  }
}
