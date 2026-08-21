import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { runInstrumentValidationCase } from "@/lib/server/instrumentValidationSuite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as { testId?: string };
    const testId = body.testId?.trim() ?? "";
    if (!testId) return Response.json({ error: "Falta testId" }, { status: 400 });

    const result = await runInstrumentValidationCase(testId);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Error ejecutando prueba de instrumentación";
    return Response.json({ error: message }, { status: 500 });
  }
}
