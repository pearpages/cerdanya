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

/**
 * Nomes ASCII: les capceleres HTTP no son text lliure i hi ha CDN (jimcdn, per exemple)
 * que responen 403 a un User-Agent amb accents. Sense aixo, Cal Xandera es quedava sense
 * cap fotografia i no hi havia manera de veure per que.
 */
const UA = 'cota-de-tast/0.1 (guia gastronomica de la Cerdanya; contacte: pere@soms.cat)';
const MAX_WIDTH = 2000;
const MIN_WIDTH = 640;

/**
 * Imatges generades amb IA, rebutjades pel nom del fitxer.
 *
 * No és una qüestió de gust: la fitxa acredita cada imatge com a «Foto — Casa X · Cortesia
 * del restaurant», és a dir, afirma que és una fotografia d'aquella casa. Un plat que no ha
 * existit mai trenca exactament la promesa que sosté tot el lloc. Somnia en tenia dues de
 * Gemini publicades al seu propi web i el crawler se les va empassar.
 *
 * El filtre és pel nom perquè és el que es pot automatitzar; no atrapa una imatge sintètica
 * rebatejada. L'única defensa contra aquestes és mirar-se-les: les marques d'aigua dels
 * generadors solen ser a la cantonada inferior dreta.
 *
 * La llista creix amb el que va apareixent. Somnia en tenia nou de Gemini i, en tornar-hi,
 * dues més de ChatGPT: val més afegir-hi un generador de sobres que deixar-ne passar un.
 */
const SYNTHETIC =
  /gemini[_-]?generated|chatgpt[_-]?image|openai|sora[_-]?image|midjourney|dall.?e|stable.?diffusion|adobe.?firefly|nightcafe|leonardo\.ai|grok[_-]?image|ai.?generated|_ai_gen/i;

/**
 * Cartells i reclams. Passen tots els filtres de mida i de contrast perquè són imatges
 * de debò, però el que retraten és una promoció, no un restaurant: Arç tenia un
 * «pop-up-web-2.jpg» amb un «Reserveu directe, guanyeu més» a la galeria.
 */
const PROMO = /pop-?up|banner|promo(?:cio|tion)|newsletter|cartell|reserva.?directa|black.?friday/i;
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

/**
 * Empremta perceptual de 64 bits (dHash): es redueix a 9x8 en gris i es compara cada
 * píxel amb el del costat. Dues versions de la mateixa foto —un retall, una mida
 * diferent— donen empremtes gairebé iguals encara que els fitxers no s'assemblin gens.
 */
async function fingerprint(image) {
  const raw = await image
    .clone()
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer();

  let bits = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const left = raw[row * 9 + col];
      const right = raw[row * 9 + col + 1];
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits;
}

function hamming(a, b) {
  let diff = a ^ b;
  let count = 0;
  while (diff > 0n) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}

async function saveImage(buffer, slug, index, minWidth = MIN_WIDTH) {
  const dir = resolve(ASSETS, slug);
  await mkdir(dir, { recursive: true });

  const image = sharp(buffer, { failOn: 'error' });
  const meta = await image.metadata();

  if ((meta.width ?? 0) < minWidth) {
    throw new Error(`massa petita (${meta.width}px)`);
  }

  /**
   * Les targetes retallen a 4:3 i la capçalera de fitxa encara més ampla. Una tira de
   * 5:1 (capçalera de web) o una columna de 1:2,5 (cartell de carta, panorama de
   * Commons) no en surt una fotografia, en surt una franja. Val mes descartar-la.
   */
  const ratio = (meta.width ?? 1) / (meta.height ?? 1);
  if (ratio > 2.4 || ratio < 0.5) {
    throw new Error(`proporcio de tira (${meta.width}x${meta.height})`);
  }

  /**
   * Un web publica moltes imatges que no son fotografies: logotips, cartes en text sobre
   * un fons pla, degradats de farciment. Totes tenen molt poca variacio de to. Una
   * fotografia de sala o de plat no baixa d'aquest llindar.
   */
  const stats = await image.stats();
  const spread = Math.max(...stats.channels.map((c) => c.stdev));
  if (spread < 26) {
    throw new Error(`sense contingut fotografic (variacio ${spread.toFixed(1)})`);
  }

  const hash = await fingerprint(image);

  const file = `${String(index).padStart(2, '0')}.jpg`;
  // Les mides que es desen son les del fitxer resultant, no una barreja de l'amplada
  // retallada amb l'alçada original: amb la barreja, una foto normal semblava una tira.
  const out = await image
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(resolve(dir, file));

  return { file, width: out.width, height: out.height, hash };
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

/**
 * Una foto de Commons no es pot repetir en dues fitxes. Als pobles amb quatre restaurants
 * i poc material lliure, sense aixo totes quatre acabaven amb la mateixa vista del
 * campanar i el lloc semblava trencat. Es sembra amb el que ja hi ha al manifest perque
 * una execucio amb `--only` no repeteixi el que ja fa servir una altra fitxa.
 */
const usedCommons = new Set();
for (const [slug, images] of Object.entries(manifest)) {
  if (only?.has(slug)) continue;
  for (const image of images) {
    if (!image.isOfficial && image.sourceUrl) usedCommons.add(image.sourceUrl);
  }
}

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
    // Es compten només les que encara no té una altra fitxa: si no, dues consultes que
    // tornen fotos ja gastades esgoten el pressupost i la casa es queda sense res.
    const usable = commonsCandidates.filter((c) => !usedCommons.has(c.sourceUrl)).length;
    if (officialCandidates.length + usable >= want * 3) break;
    commonsCandidates.push(...(await commonsSearch(query)));
    await sleep(350);
  }

  const seen = new Set();
  const candidates = [...officialCandidates, ...commonsCandidates].filter((c) => {
    if (!c.downloadUrl || seen.has(c.downloadUrl)) return false;
    if (!c.isOfficial && usedCommons.has(c.sourceUrl)) return false;
    seen.add(c.downloadUrl);
    return true;
  });

  const kept = [];
  /** Empremtes del que ja ha entrat en aquesta fitxa, per no repetir-hi la mateixa foto. */
  const hashes = [];
  let index = 1;

  for (const candidate of candidates) {
    if (kept.length >= want) break;

    if (!candidate.author || !candidate.license || !candidate.sourceUrl) {
      report.skipped.push(`${entry.slug}: crèdit incomplet → ${candidate.downloadUrl}`);
      continue;
    }

    if (SYNTHETIC.test(candidate.downloadUrl)) {
      report.skipped.push(`${entry.slug}: imatge sintètica → ${candidate.downloadUrl}`);
      continue;
    }

    if (candidate.isOfficial && PROMO.test(candidate.downloadUrl)) {
      report.skipped.push(`${entry.slug}: reclam, no fotografia → ${candidate.downloadUrl}`);
      continue;
    }

    try {
      const buffer = await get(candidate.downloadUrl, true);
      // Algunes cases només publiquen fotos petites; s'accepten amb un llindar propi
      // abans que quedar-se sense cap imatge seva.
      const saved = await saveImage(buffer, entry.slug, index, entry.minWidth ?? MIN_WIDTH);

      // Un retall i l'original de la mateixa foto passen tots dos els filtres de mida:
      // només l'empremta els distingeix, i una galeria de quatre no pot repetir-ne cap.
      const twin = hashes.find((h) => hamming(h, saved.hash) <= 8);
      if (twin !== undefined) {
        report.skipped.push(`${entry.slug}: repetida → ${candidate.downloadUrl}`);
        continue;
      }
      hashes.push(saved.hash);

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
      if (!candidate.isOfficial) usedCommons.add(candidate.sourceUrl);
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
