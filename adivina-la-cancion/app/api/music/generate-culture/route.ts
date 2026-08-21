import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { generateCultureRound, type CultureGenerationMode } from "@/lib/server/cultureGenerator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as {
      mode?: CultureGenerationMode;
      count?: number;
      seed?: string;
    };

    const mode: CultureGenerationMode = body.mode === "development" ? "development" : "game";
    const count = Number.isFinite(body.count) ? Number(body.count) : 9;
    const result = await generateCultureRound({
      mode,
      count,
      seed: body.seed?.trim() || `${Date.now()}`,
    });

    return Response.json({ result });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "No se pudo generar Cultura Musical";
    return Response.json({ error: message }, { status: 500 });
  }
}
