import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { getStarterCatalogStatus } from "@/lib/server/starterCatalogImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    return Response.json({ result: await getStarterCatalogStatus() });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Error leyendo el catálogo inicial" }, { status: 500 });
  }
}
