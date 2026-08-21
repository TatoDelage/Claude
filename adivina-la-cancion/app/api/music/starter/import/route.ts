import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { importStarterSeed } from "@/lib/server/starterCatalogImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { seedId?: string; spotifyId?: string };
    const seedId = body.seedId?.trim() ?? "";
    if (!seedId) return Response.json({ error: "Falta seedId" }, { status: 400 });
    const result = await importStarterSeed(seedId, body.spotifyId?.trim() || undefined);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Error importando semilla" }, { status: 500 });
  }
}
