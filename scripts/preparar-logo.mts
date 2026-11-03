/**
 * Prepara o logotipo para o site a partir de uma imagem com fundo liso:
 * remove o fundo (vira transparente), recorta as margens e gera duas versões —
 * a original (fundos claros) e uma clara (fundos escuros: hero, rodapé, painel).
 *
 *   npm run logo:preparar -- --arquivo "C:\caminho\logo.png" [--nome "Flavia Melo"] [--tagline "Makeup artist"]
 *   npm run logo:preparar -- --arquivo logo.png --so-previa      (só gera as prévias em .data/logo/)
 *
 * Com --so-previa nada é gravado no banco. Sem ele, as versões são salvas no banco
 * (DATABASE_URL) e aplicadas nas configurações do estúdio.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const file = arg("arquivo");
if (!file || !fs.existsSync(file)) {
  console.error('Informe a imagem: npm run logo:preparar -- --arquivo "caminho/da/logo.png"');
  process.exit(1);
}
const tolerance = Number(arg("tolerancia") ?? 26); // distância de cor considerada "fundo"
const soft = 34; // faixa de transição suave nas bordas
const onlyPreview = process.argv.includes("--so-previa");

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const px = (x: number, y: number) => (y * W + x) * 4;

// Cor do fundo: mediana de amostras nos quatro cantos
const samples: number[][] = [];
for (const [cx, cy] of [[0, 0], [W - 12, 0], [0, H - 12], [W - 12, H - 12]]) {
  for (let y = cy; y < cy + 12; y++) for (let x = cx; x < cx + 12; x++) samples.push([data[px(x, y)], data[px(x, y) + 1], data[px(x, y) + 2]]);
}
const median = (k: number) => samples.map((s) => s[k]).sort((a, b) => a - b)[Math.floor(samples.length / 2)];
const bg = [median(0), median(1), median(2)];

const out = Buffer.alloc(W * H * 4);
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = px(x, y);
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const d = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
    const a = Math.max(0, Math.min(1, (d - tolerance) / soft));
    if (a <= 0) continue;
    // Remove a "contaminação" do fundo nas bordas semitransparentes
    const un = (c: number, k: number) => Math.max(0, Math.min(255, Math.round((c - bg[k] * (1 - a)) / a)));
    out[i] = un(r, 0);
    out[i + 1] = un(g, 1);
    out[i + 2] = un(b, 2);
    out[i + 3] = Math.round(a * 255);
    if (a > 0.05) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX <= minX) {
  console.error("Não encontrei o desenho: a imagem parece ser só fundo.");
  process.exit(1);
}
const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03);
const crop = { left: Math.max(0, minX - pad), top: Math.max(0, minY - pad), width: Math.min(W, maxX + pad) - Math.max(0, minX - pad), height: Math.min(H, maxY + pad) - Math.max(0, minY - pad) };

// Versão clara: mesma forma e transparência, cores levadas a tons de off-white rosado
const light = Buffer.from(out);
for (let i = 0; i < light.length; i += 4) {
  if (!light[i + 3]) continue;
  const lum = (0.2126 * light[i] + 0.7152 * light[i + 1] + 0.0722 * light[i + 2]) / 255;
  const t = 0.78 + lum * 0.18; // mantém um leve contraste entre partes escuras e claras
  light[i] = Math.round(light[i] * (1 - t) + 251 * t);
  light[i + 1] = Math.round(light[i + 1] * (1 - t) + 236 * t);
  light[i + 2] = Math.round(light[i + 2] * (1 - t) + 238 * t);
}

const make = (buf: Buffer) =>
  sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .extract(crop)
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer({ resolveWithObject: true });

const dark = await make(out);
const lite = await make(light);

const dir = path.join(process.cwd(), ".data", "logo");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "logo.webp"), dark.data);
fs.writeFileSync(path.join(dir, "logo-clara.webp"), lite.data);
// Prévias sobre as cores reais do site para conferência
for (const [name, buf, color] of [["previa-fundo-claro.png", dark.data, "#f6f2f1"], ["previa-fundo-escuro.png", lite.data, "#052f32"]] as const) {
  const m = await sharp(buf).metadata();
  await sharp({ create: { width: m.width! + 80, height: m.height! + 80, channels: 4, background: color } })
    .composite([{ input: buf, left: 40, top: 40 }])
    .png()
    .toFile(path.join(dir, name));
}
console.log(`Fundo detectado: rgb(${bg.join(", ")}). Logo recortada: ${dark.info.width}x${dark.info.height}. Prévias em .data/logo/`);

if (!onlyPreview) {
  const { getDb, closeDb } = await import("../src/db/index");
  const { media } = await import("../src/db/schema");
  const { saveSettings } = await import("../src/server/settings");
  const db = await getDb();
  const ins = async (buf: Buffer, w: number, h: number, alt: string) =>
    (await db.insert(media).values({ mime: "image/webp", data: buf, width: w, height: h, bytes: buf.length, alt }).returning({ id: media.id }))[0].id;
  const nome = arg("nome");
  const tagline = arg("tagline");
  const logoId = await ins(dark.data, dark.info.width, dark.info.height, nome ?? "Logotipo");
  const logoLightId = await ins(lite.data, lite.info.width, lite.info.height, nome ?? "Logotipo");
  await saveSettings({ logoId, logoLightId, ...(nome ? { studioName: nome } : {}), ...(tagline ? { tagline } : {}) }, null);
  console.log("Logotipo aplicado nas configurações do estúdio.");
  await closeDb();
}
