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
const MAPS_DIR = resolve(ROOT, 'src/assets/maps');
const MAP_SOURCE = resolve(ROOT, 'src/data/map-source.json');

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

const problems = [];
const warnings = [];
let fileCount = 0;
let imageCount = 0;
/** slug → frontmatter, per comprovar els mapes un cop llegides totes les fitxes. */
const slugs = new Map();

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

  slugs.set(file.replace(/\.md$/, ''), data ?? {});

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

/* ---- Mapes de les fitxes ------------------------------------------------ */

/**
 * Els mapes són tiles d'OpenStreetMap i tenen el mateix contracte que les fotografies:
 * no se'n publica cap sense dir d'on surt. Com que tots surten del mateix lloc, el
 * crèdit és un de sol i viu a `src/data/map-source.json`; el que es comprova aquí és
 * que hi sigui, que estigui complet, i que cada mapa del disc pengi d'una fitxa que el
 * pugui acreditar — sense `lat`/`lng` la fitxa no pot enllaçar el punt d'origen.
 */
let mapCount = 0;
try {
  const maps = (await readdir(MAPS_DIR)).filter((f) => f.endsWith('.webp'));

  if (maps.length > 0) {
    let source;
    try {
      source = JSON.parse(await readFile(MAP_SOURCE, 'utf8'));
    } catch (error) {
      problems.push(
        `hi ha ${maps.length} mapes a src/assets/maps/ però src/data/map-source.json no es pot llegir — ${error.message}`,
      );
    }

    if (source) {
      for (const field of ['author', 'license', 'licenseUrl', 'sourceUrl', 'attribution']) {
        if (!source[field] || String(source[field]).trim() === '') {
          problems.push(`map-source.json: falta "${field}"`);
        }
      }
    }

    for (const file of maps) {
      mapCount += 1;
      const slug = file.replace(/\.webp$/, '');
      const data = slugs.get(slug);

      if (!data) {
        problems.push(
          `src/assets/maps/${file}: no hi ha cap fitxa «${slug}» — esborra'l o torna a executar npm run data:maps`,
        );
        continue;
      }

      if (data.lat == null || data.lng == null) {
        problems.push(
          `${slug}: té mapa però no té lat/lng al frontmatter, així que no en pot acreditar el punt — executa npm run data:locations:apply`,
        );
      }
    }
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    problems.push(`src/assets/maps: no es pot llegir — ${error.message}`);
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
  `✓ crèdits correctes — ${imageCount} imatges (${fileCount} fitxes + ${siteCount} del lloc)${
    mapCount > 0 ? ` i ${mapCount} mapes d’OpenStreetMap` : ''
  }`,
);
