import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { BusinessError } from "./errors";

const MAX_UPLOAD = 8 * 1024 * 1024; // 8 MB antes da otimização
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"];

/**
 * Recebe uma foto, corrige a orientação, redimensiona (máx. 1800px) e converte para WebP.
 * O arquivo fica no banco (persistente entre reinícios e deploys) e é servido por /api/media/:id.
 */
export async function saveUploadedImage(file: File, actorId: string, alt?: string) {
  if (!file || file.size === 0) throw new BusinessError("Selecione uma imagem.");
  if (file.size > MAX_UPLOAD) throw new BusinessError("A imagem deve ter no máximo 8 MB.");
  if (file.type && !ACCEPTED.includes(file.type)) throw new BusinessError("Formato não suportado. Envie JPG, PNG, WebP ou AVIF.");
  const sharp = (await import("sharp")).default;
  let out: { data: Buffer; info: { width: number; height: number; size: number } };
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error" })
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new BusinessError("Não foi possível ler esta imagem. Tente outro arquivo.");
  }
  const db = await getDb();
  const [row] = await db
    .insert(media)
    .values({ mime: "image/webp", data: out.data, width: out.info.width, height: out.info.height, bytes: out.info.size, alt: alt?.slice(0, 200) ?? null, createdBy: actorId })
    .returning({ id: media.id });
  return row.id;
}

export async function getMedia(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const [row] = await db.select().from(media).where(eq(media.id, id));
  return row ?? null;
}

/** Lê um campo de arquivo opcional de um FormData e salva, retornando o id (ou undefined se vazio). */
export async function imageFromForm(form: FormData, field: string, actorId: string, alt?: string) {
  const f = form.get(field);
  if (f instanceof File && f.size > 0) return saveUploadedImage(f, actorId, alt);
  return undefined;
}
