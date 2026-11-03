/**
 * Prepara o logotipo para o site a partir de uma imagem com fundo liso:
 * remove o fundo (vira transparente), recorta as margens e gera duas versões —
 * a original (fundos claros) e uma clara (fundos escuros: hero, rodapé, painel).
 *
 *   npm run logo:preparar -- --arquivo "C:\caminho\logo.png" [--nome "Flavia Melo"] [--tagline "Makeup artist"]
 *   npm run logo:preparar -- --arquivo logo.png --so-previa      (só gera as prévias em .data/logo/)
 *   --ate-y 966     ignora tudo abaixo dessa linha da imagem (ex.: remover um slogan pequeno demais)
 *   --arte x,y,l,a  região de ilustração (ex.: o rosto) com conversão própria na versão clara, preservando cílios e contornos
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
const untilY = arg("ate-y") ? Number(arg("ate-y")) : Infinity;
// Região de ilustração (ex.: rosto) com tratamento próprio na versão clara: "x,y,largura,altura" da imagem original
const artBox = arg("arte")?.split(",").map(Number) as [number, number, number, number] | undefined;
const inArt = (x: number, y: number) => !!artBox && x >= artBox[0] && y >= artBox[1] && x < artBox[0] + artBox[2] && y < artBox[1] + artBox[3];

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
for (let y = 0; y < Math.min(H, untilY); y++) {
  for (let x = 0; x < W; x++) {
    const i = px(x, y);
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const d = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
    // Na ilustração, rosados pálidos (sombra, boca) não podem "furar": recorte mais sensível e transição curta
    const raw = inArt(x, y) ? Math.max(0, Math.min(1, (d - 14) / 14)) : Math.max(0, Math.min(1, (d - tolerance) / soft));
    const a = raw < 0.12 ? 0 : raw; // descarta o ruído de compressão do fundo
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
// Preenche furos pequenos e totalmente cercados na ilustração (ex.: brilho na pálpebra quase da cor do fundo).
// Áreas transparentes ligadas à borda da região (pele, espaço entre cílios) continuam abertas.
if (artBox) {
  const [ax, ay, aw, ah] = artBox;
  const w = Math.min(aw, W - ax);
  const h = Math.min(ah, Math.min(H, untilY) - ay);
  const open = new Uint8Array(w * h);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) open[yy * w + xx] = out[px(ax + xx, ay + yy) + 3] < 235 ? 1 : 0;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let k = 0; k < w * h; k++) {
    if (!open[k] || seen[k]) continue;
    // componente conexa de pixels transparentes
    const comp: number[] = [];
    let touchesEdge = false;
    stack.push(k);
    seen[k] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      comp.push(c);
      const cx = c % w;
      const cy = (c / w) | 0;
      if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) touchesEdge = true;
      for (const n of [c - 1, c + 1, c - w, c + w]) {
        if (n < 0 || n >= w * h || seen[n] || !open[n]) continue;
        if ((n === c - 1 && cx === 0) || (n === c + 1 && cx === w - 1)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (touchesEdge || comp.length > 600) continue;
    for (const c of comp) {
      const i = px(ax + (c % w), ay + ((c / w) | 0));
      out[i] = data[i];
      out[i + 1] = data[i + 1];
      out[i + 2] = data[i + 2];
      out[i + 3] = 255;
    }
  }
}

if (maxX <= minX) {
  console.error("Não encontrei o desenho: a imagem parece ser só fundo.");
  process.exit(1);
}
const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03);
const crop = { left: Math.max(0, minX - pad), top: Math.max(0, minY - pad), width: Math.min(W, maxX + pad) - Math.max(0, minX - pad), height: Math.min(H, maxY + pad) - Math.max(0, minY - pad) };

// Versão clara (para vidro/fundos escuros): inverte a relação de tons da original.
// Escuros (letras vinho, cílios, contornos) -> quase branco; médios (rosé, traços) -> rosé-dourado claro;
// muito claros (sombra da pálpebra, brilhos) -> rosé fechado e translúcido, para os detalhes escuros
// da original (cílios, vinco do olho) continuarem se destacando.
const light = Buffer.from(out);
const ink = [253, 244, 242]; // off-white rosado
const gold = [242, 196, 184]; // rosé-dourado claro
const dusk = [201, 138, 132]; // rosé fechado
const mix = (a: number[], b: number[], t: number) => a.map((v, k) => Math.round(v * (1 - t) + b[k] * t));
const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
for (let i = 0; i < light.length; i += 4) {
  if (!light[i + 3]) continue;
  // tom percebido na imagem ORIGINAL (antes de remover o fundo), que é o que o olho vê
  const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  const p = i / 4;
  if (inArt(p % W, Math.floor(p / W))) {
    // ilustração: traços escuros (cílios, contornos) brilham; preenchimentos pálidos (sombra, pele) recuam
    const c = lum < 0.3 ? ink : mix(gold, dusk, smooth((lum - 0.3) / 0.3));
    light[i] = c[0];
    light[i + 1] = c[1];
    light[i + 2] = c[2];
    continue;
  }
  const c = lum < 0.62 ? mix(ink, gold, smooth((lum - 0.28) / (0.62 - 0.28))) : mix(gold, dusk, smooth((lum - 0.62) / (0.9 - 0.62)));
  light[i] = c[0];
  light[i + 1] = c[1];
  light[i + 2] = c[2];
  if (lum > 0.7) light[i + 3] = Math.round(light[i + 3] * (1 - 0.45 * smooth((lum - 0.7) / 0.25)));
}

// Suaviza a granulação da imagem original só na ilustração (evita aspecto manchado na sombra e na boca)
if (artBox) {
  const [ax, ay, aw, ah] = artBox;
  const w = Math.min(aw, W - ax);
  const h = Math.min(ah, Math.min(H, untilY) - ay);
  const region = await sharp(light, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: ax, top: ay, width: w, height: h })
    .blur(0.8)
    .raw()
    .toBuffer();
  for (let yy = 0; yy < h; yy++) region.copy(light, ((ay + yy) * W + ax) * 4, yy * w * 4, (yy + 1) * w * 4);
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
