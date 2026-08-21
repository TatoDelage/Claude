import { spotifyIsConfigured } from "@/lib/server/spotifyCatalog";
import { supabaseMusicWriteIsConfigured } from "@/lib/server/musicIngestion";
import { musixmatchIsConfigured } from "@/lib/server/musixmatchLyrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    spotifyConfigured: spotifyIsConfigured(),
    supabaseWriteConfigured: supabaseMusicWriteIsConfigured(),
    adminSecretConfigured: Boolean(process.env.MUSIC_ADMIN_SECRET),
    musixmatchConfigured: musixmatchIsConfigured(),
  });
}
