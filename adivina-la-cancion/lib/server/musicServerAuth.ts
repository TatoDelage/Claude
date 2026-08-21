import { timingSafeEqual } from "node:crypto";

export class MusicAdminAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function assertMusicAdmin(request: Request): void {
  const expected = process.env.MUSIC_ADMIN_SECRET;
  if (!expected) throw new MusicAdminAuthError(503, "MUSIC_ADMIN_SECRET no está configurado");

  const provided = request.headers.get("x-music-admin-secret") ?? "";
  if (!provided || !safeEqual(provided, expected)) {
    throw new MusicAdminAuthError(401, "Clave de administración musical incorrecta");
  }
}
