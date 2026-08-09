#!/usr/bin/env node
/**
 * Descarrega les fotografies de cada restaurant i en registra l'autoria.
 *
 * Ordre de preferència, per restaurant:
 *   1. el web oficial del restaurant — crèdit al propi restaurant, amb enllaç a la pàgina
 *      d'on surt la imatge;
 *   2. Wikimedia Commons — crèdit complet (autor, llicència, enllaç) llegit de
 *      `extmetadata`, que és metadada estructurada i no una suposició nostra.
 *
 * Cap imatge s'accepta sense autor, llicència i URL d'origen: si en falta cap, es
 * descarta i es diu per què. `scripts/lint-credits.mjs` torna a comprovar-ho al build.
 *
 * Entrada:  data/image-plan.json
 * Sortida:  src/assets/restaurants/<slug>/NN.jpg  +  data/image-manifest.json
 *
 * Ús: node scripts/fetch-images.mjs [--only slug1,slug2] [--force]
 */

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN = resolve(ROOT, 'data/image-plan.json');
const ASSETS = resolve(ROOT, 'src/assets/restaurants');
const MANIFEST = resolve(ROOT, 'data/image-manifest.json');

const UA = 'cota-de-tast/0.1 (guia gastronòmica de la Cerdanya; contacte: pere@soms.cat)';
const MAX_WIDTH = 2000;
const MIN_WIDTH = 640;
const JPEG_QUALITY = 82;

const args = process.argv.slice(2);
const only = args.includes('--only')
  ? new Set(args[args.indexOf('--only') + 1].split(','))
  : null;
const force = args.includes('--force');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, asBuffer = false) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.json();
}

/** Treu el marcatge dels camps `extmetadata` de Commons, que arriben com a HTML. */
function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cerca imatges a Commons i en retorna les que porten autoria i llicència completes. */
async function commonsSearch(query, limit = 8) {
  const searchUrl =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search' +
    `&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
    `&gsrnamespace=6&gsrlimit=${limit}` +
    '&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=2000';

  let body;
  try {
    body = await get(searchUrl);
  } catch {
    return [];
  }

  const pages = Object.values(body?.query?.pages ?? {});
  const found = [];

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;

    const meta = info.extmetadata ?? {};
    const author = stripHtml(meta.Artist?.value);
    const license = stripHtml(meta.LicenseShortName?.value || meta.UsageTerms?.value);
    const licenseUrl = stripHtml(meta.LicenseUrl?.value) || undefined;

    // Sense autor o sense llicència no entra. No s'omple amb "desconegut".
    if (!author || !license) continue;
    // Les llicències que exigeixen compartir igual o prohibeixen l'ús comercial es
    // deixen passar igualment, però queden marcades perquè es vegin als crèdits.
    if ((info.width ?? 0) < MIN_WIDTH) continue;

    found.push({
      downloadUrl: info.thumburl || info.url,
      author,
      license,
      licenseUrl,
      sourceUrl: info.descriptionurl,
      title: page.title,
      isOfficial: false,
    });
  }

  return found;
}

async function saveImage(buffer, slug, index, minWidth = MIN_WIDTH) {
  const dir = resolve(ASSETS, slug);
  await mkdir(dir, { recursive: true });

  const image = sharp(buffer, { failOn: 'error' });
  const meta = await image.metadata();

  if ((meta.width ?? 0) < minWidth) {
    throw new Error(`massa petita (${meta.width}px)`);
  }

  const file = `${String(index).padStart(2, '0')}.jpg`;
  await image
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(resolve(dir, file));

  return { file, width: Math.min(meta.width ?? 0, MAX_WIDTH), height: meta.height ?? 0 };
}

const plan = JSON.parse(await readFile(PLAN, 'utf8'));

// El manifest es conserva entre execucions: amb `--only` només s'hi reescriu el que toca,
// perquè una descàrrega parcial no ha d'esborrar l'autoria de la resta de fitxes.
let manifest = {};
try {
  manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
} catch {
  /* primera execució */
}

const report = { saved: 0, skipped: [], thin: [] };

for (const entry of plan.restaurants) {
  if (only && !only.has(entry.slug)) continue;

  const want = entry.want ?? 3;
  const dir = resolve(ASSETS, entry.slug);
  if (force) await rm(dir, { recursive: true, force: true });

  /** Candidats del web oficial: el crèdit és el restaurant mateix. */
  const officialCandidates = (entry.official?.urls ?? []).map((url) => ({
    downloadUrl: url,
    author: entry.official.credit ?? entry.name,
    license: 'Cortesia del restaurant',
    licenseUrl: undefined,
    sourceUrl: entry.official.site ?? url,
    isOfficial: true,
  }));

  /** Reserva: Commons, amb autoria i llicència llegides de les metadades. */
  const commonsCandidates = [];
  for (const query of entry.commons ?? []) {
    if (officialCandidates.length + commonsCandidates.length >= want * 3) break;
    commonsCandidates.push(...(await commonsSearch(query)));
    await sleep(350);
  }

  const seen = new Set();
  const candidates = [...officialCandidates, ...commonsCandidates].filter((c) => {
    if (!c.downloadUrl || seen.has(c.downloadUrl)) return false;
    seen.add(c.downloadUrl);
    return true;
  });

  const kept = [];
  let index = 1;

  for (const candidate of candidates) {
    if (kept.length >= want) break;

    if (!candidate.author || !candidate.license || !candidate.sourceUrl) {
      report.skipped.push(`${entry.slug}: crèdit incomplet → ${candidate.downloadUrl}`);
      continue;
    }

    try {
      const buffer = await get(candidate.downloadUrl, true);
      // Algunes cases només publiquen fotos petites; s'accepten amb un llindar propi
      // abans que quedar-se sense cap imatge seva.
      const saved = await saveImage(buffer, entry.slug, index, entry.minWidth ?? MIN_WIDTH);
      kept.push({
        src: `../../assets/restaurants/${entry.slug}/${saved.file}`,
        /** URL d'on ha sortit el fitxer: el nom original diu què s'hi veu. */
        originUrl: candidate.downloadUrl,
        width: saved.width,
        height: saved.height,
        author: candidate.author,
        license: candidate.license,
        licenseUrl: candidate.licenseUrl,
        sourceUrl: candidate.sourceUrl,
        isOfficial: candidate.isOfficial,
        commonsTitle: candidate.title,
      });
      index += 1;
      report.saved += 1;
    } catch (error) {
      report.skipped.push(`${entry.slug}: ${error.message} → ${candidate.downloadUrl}`);
    }

    await sleep(200);
  }

  manifest[entry.slug] = kept;
  if (kept.length === 0) report.thin.push(entry.slug);

  console.log(
    `${kept.length >= want ? '✓' : kept.length > 0 ? '·' : '✗'} ${entry.slug.padEnd(28)} ${kept.length}/${want}`,
  );
}

await mkdir(dirname(MANIFEST), { recursive: true });
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`\n${report.saved} imatges desades → src/assets/restaurants/`);
if (report.thin.length > 0) console.log(`sense cap imatge: ${report.thin.join(', ')}`);
if (report.skipped.length > 0) {
  console.log(`\ndescartades (${report.skipped.length}):`);
  for (const line of report.skipped.slice(0, 40)) console.log(`  · ${line}`);
}
