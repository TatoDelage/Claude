import { spotifyIsConfigured } from "@/lib/server/spotifyCatalog";
import { supabaseMusicWriteIsConfigured } from "@/lib/server/musicIngestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    spotifyConfigured: spotifyIsConfigured(),
    supabaseWriteConfigured: supabaseMusicWriteIsConfigured(),
    adminSecretConfigured: Boolean(process.env.MUSIC_ADMIN_SECRET),
    lyricsProvider: "lrclib",
    lyricsProviderConfigured: true,
    musixmatchConfigured: Boolean(process.env.MUSIXMATCH_API_KEY?.trim()),
  });
}
