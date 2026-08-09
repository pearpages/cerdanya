#!/usr/bin/env node
/**
 * Comprova que cap imatge del lloc entra sense saber de qui és.
 *
 * S'executa a `prebuild`, així que un crèdit incomplet atura la publicació. És el que
 * converteix la promesa d'atribució en una garantia i no en una bona intenció: si un
 * dia cal retirar una foto, aquí hi ha d'on va sortir.
 *
 * Per a cada `images[]` del frontmatter verifica:
 *   1. el fitxer existeix al disc
 *   2. hi ha `author`, `license` i `sourceUrl`
 *   3. hi ha `alt` amb contingut real (no el nom del restaurant repetit i prou)
 *
 * Les fotos que no pengen de cap fitxa (portada i seccions generals) viuen a
 * `src/data/site-images.json` i passen exactament la mateixa comprovació: no tenen
 * esquema de col·lecció que les validi, així que aquest és l'únic filtre que tenen.
 *
 * Ús: node scripts/lint-credits.mjs
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = resolve(ROOT, 'src/content/restaurants');
const ASSETS_DIR = resolve(ROOT, 'src/assets/restaurants');
const SITE_IMAGES = resolve(ROOT, 'src/data/site-images.json');

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

const problems = [];
const warnings = [];
let fileCount = 0;
let imageCount = 0;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * El contracte, un de sol per a totes les imatges del lloc: fitxer al disc, autor,
 * llicència, origen i un `alt` que descrigui alguna cosa.
 */
async function checkImage({ image, at, path, label }) {
  imageCount += 1;

  if (!path) {
    problems.push(`${at}: falta "${label}"`);
    return;
  }

  if (!(await exists(path))) {
    problems.push(`${at}: el fitxer no existeix → ${path.replace(`${ROOT}/`, '')}`);
  }

  for (const field of ['author', 'license', 'sourceUrl']) {
    if (!image[field] || String(image[field]).trim() === '') {
      problems.push(`${at}: falta "${field}"`);
    }
  }

  if (!image.alt || String(image.alt).trim().length < 12) {
    problems.push(`${at}: "alt" buit o massa curt per descriure res`);
  }

  if (image.sourceUrl && !/^https?:\/\//.test(image.sourceUrl)) {
    problems.push(`${at}: "sourceUrl" no és una URL — ${image.sourceUrl}`);
  }
}

/* ---- Imatges del lloc (portada i seccions generals) --------------------- */
let siteCount = 0;
try {
  const site = JSON.parse(await readFile(SITE_IMAGES, 'utf8'));
  const seen = new Set();

  for (const [index, image] of (site.images ?? []).entries()) {
    siteCount += 1;
    const at = `site-images.json · ${image?.id ?? `imatge ${index + 1}`}`;

    if (!image?.id) problems.push(`${at}: falta "id"`);
    else if (seen.has(image.id)) problems.push(`${at}: l'id està repetit`);
    else seen.add(image.id);

    if (!image?.usedOn) problems.push(`${at}: falta "usedOn" (on es fa servir)`);

    await checkImage({
      image: image ?? {},
      at,
      path: image?.file ? resolve(ASSETS_DIR, image.file) : null,
      label: 'file',
    });
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    problems.push(`src/data/site-images.json: no es pot llegir — ${error.message}`);
  }
}

let entries = [];
try {
  entries = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.md'));
} catch {
  console.log('· Encara no hi ha contingut a src/content/restaurants — només es miren les del lloc.');
}

for (const file of entries) {
  const path = join(CONTENT_DIR, file);
  const raw = await readFile(path, 'utf8');
  const match = raw.match(FRONTMATTER);

  if (!match) {
    problems.push(`${file}: no té frontmatter`);
    continue;
  }

  fileCount += 1;

  let data;
  try {
    data = parse(match[1]);
  } catch (error) {
    problems.push(`${file}: el frontmatter no és YAML vàlid — ${error.message}`);
    continue;
  }

  const images = data?.images ?? [];

  if (images.length === 0) {
    warnings.push(`${file}: sense cap imatge`);
    continue;
  }

  for (const [index, image] of images.entries()) {
    await checkImage({
      image: image ?? {},
      at: `${file} · imatge ${index + 1}`,
      path: image?.src ? resolve(CONTENT_DIR, image.src) : null,
      label: 'src',
    });
  }
}

for (const warning of warnings) console.warn(`⚠ ${warning}`);

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} problema/es de crèdits:\n`);
  for (const problem of problems) console.error(`  · ${problem}`);
  console.error('\nCap imatge es publica sense autor, llicència i URL d’origen.\n');
  process.exit(1);
}

console.log(
  `✓ crèdits correctes — ${imageCount} imatges (${fileCount} fitxes + ${siteCount} del lloc)`,
);
