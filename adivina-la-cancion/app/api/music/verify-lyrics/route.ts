import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { verifyLyricsFact } from "@/lib/server/lyricsFactVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { songId?: string; query?: string };
    const songId = body.songId?.trim() ?? "";
    const query = body.query?.trim() ?? "";

    if (!songId) return Response.json({ error: "Falta songId" }, { status: 400 });
    if (!query) return Response.json({ error: "Falta palabra o frase" }, { status: 400 });

    const result = await verifyLyricsFact(songId, query);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Error verificando la letra";
    return Response.json({ error: message }, { status: 500 });
  }
}
