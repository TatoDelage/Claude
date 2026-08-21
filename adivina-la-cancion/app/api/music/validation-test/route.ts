import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { runSongValidationCase } from "@/lib/server/songValidationSuite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { testId?: string };
    const testId = body.testId?.trim() ?? "";
    if (!testId) return Response.json({ error: "Falta testId" }, { status: 400 });
    const report = await runSongValidationCase(testId);
    return Response.json({ report });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Error ejecutando la prueba de validación";
    return Response.json({ error: message }, { status: 500 });
  }
}
