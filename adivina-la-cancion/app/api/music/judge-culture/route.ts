import type { CultureChallenge } from "@/lib/cultureChallenges";
import { assertMusicAdmin, MusicAdminAuthError } from "@/lib/server/musicServerAuth";
import { cultureJudgePresetById } from "@/lib/cultureJudgePresets";
import { judgeCultureAnswer } from "@/lib/server/cultureJudge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLabChallenge(value: unknown): value is CultureChallenge {
  if (!value || typeof value !== "object") return false;
  const challenge = value as Partial<CultureChallenge>;
  return Boolean(
    typeof challenge.id === "string" &&
    challenge.id.startsWith("generated-") &&
    typeof challenge.prompt === "string" &&
    challenge.prompt.length > 0 &&
    Array.isArray(challenge.conditions) &&
    challenge.conditions.length > 0 &&
    challenge.conditions.length <= 3 &&
    challenge.autoJudge === true &&
    challenge.validationTier !== "C"
  );
}

export async function POST(request: Request) {
  try {
    assertMusicAdmin(request);
    const body = (await request.json()) as {
      presetId?: string;
      challenge?: unknown;
      answerTitle?: string;
      answerArtist?: string;
      spotifyId?: string;
    };

    const preset = cultureJudgePresetById(body.presetId?.trim() ?? "");
    const generatedChallenge = isLabChallenge(body.challenge) ? body.challenge : undefined;
    const challenge = preset?.challenge ?? generatedChallenge;
    if (!challenge) return Response.json({ error: "Reto de prueba desconocido o no válido" }, { status: 400 });

    if (!body.spotifyId && (body.answerTitle?.trim().length ?? 0) < 2) {
      return Response.json({ error: "Escribe al menos dos caracteres del título" }, { status: 400 });
    }

    const result = await judgeCultureAnswer({
      challenge,
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
