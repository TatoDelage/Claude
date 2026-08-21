import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { cultureJudgePresetById } from "@/lib/cultureJudgePresets";
import { judgeCultureAnswer } from "@/lib/server/cultureJudge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as {
      presetId?: string;
      answerTitle?: string;
      answerArtist?: string;
      spotifyId?: string;
    };

    const preset = cultureJudgePresetById(body.presetId?.trim() ?? "");
    if (!preset) return Response.json({ error: "Reto de prueba desconocido" }, { status: 400 });
    if (!body.spotifyId && (body.answerTitle?.trim().length ?? 0) < 2) {
      return Response.json({ error: "Escribe al menos dos caracteres del título" }, { status: 400 });
    }

    const result = await judgeCultureAnswer({
      challenge: preset.challenge,
      answerTitle: body.answerTitle,
      answerArtist: body.answerArtist,
      spotifyId: body.spotifyId,
    });

    return Response.json({ result });
  } catch (error) {
    if (error instanceof MusicAdminAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Error juzgando la respuesta";
    return Response.json({ error: message }, { status: 500 });
  }
}
