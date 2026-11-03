import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Criptografia simétrica (AES-256-GCM) para segredos guardados no banco
 * (ex.: Access Token do Mercado Pago cadastrado pelo painel).
 * A chave vem de APP_ENCRYPTION_KEY e nunca é gravada no banco.
 */
function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error("APP_ENCRYPTION_KEY ausente ou curta (mínimo 32 caracteres).");
  }
  return createHash("sha256").update(raw).digest();
}

export function hasEncryptionKey() {
  const raw = process.env.APP_ENCRYPTION_KEY;
  return !!raw && raw.length >= 32;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [v, iv, tag, enc] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("Segredo em formato inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(enc, "base64")), decipher.final()]).toString("utf8");
}

export function maskSecret(s: string) {
  return s.length <= 8 ? "••••" : `${s.slice(0, 8)}••••${s.slice(-4)}`;
}
