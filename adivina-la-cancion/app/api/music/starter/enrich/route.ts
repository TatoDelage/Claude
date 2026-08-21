import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { enrichStarterSong } from "@/lib/server/starterCatalogImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { songId?: string };
    const songId = body.songId?.trim() ?? "";
    if (!songId) return Response.json({ error: "Falta songId" }, { status: 400 });
    return Response.json({ result: await enrichStarterSong(songId) });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Error enriqueciendo canción" }, { status: 500 });
  }
}
