#!/usr/bin/env node
/**
 * Aboca `data/image-manifest.json` al frontmatter de cada fitxa.
 *
 * El manifest el genera `fetch-images.mjs` i porta l'autoria de cada fotografia; aquí
 * es converteix en el camp `images[]` del markdown, que és la font de veritat que
 * llegeixen les pàgines i que `lint-credits.mjs` verifica abans de cada build.
 *
 * El text alternatiu es dedueix de l'origen: a Commons, del títol del fitxer, que ja és
 * descriptiu; als webs propis, de les paraules del nom del fitxer, que solen dir si la
 * foto és de sala, de plat, de celler o d'exterior.
 *
 * Ús: node scripts/apply-image-credits.mjs
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = resolve(ROOT, 'src/content/restaurants');
const MANIFEST = resolve(ROOT, 'data/image-manifest.json');

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Paraules del nom de fitxer → què es veu a la foto. */
const HINTS = [
  [/exterior|fachada|facana|entrada|cartel|puerta|inici|home|principal|bienvenida/, (n) => `Exterior de ${n}`],
  [/terras|terrass|jardi|jardin|patio/, (n) => `Terrassa de ${n}`],
  [/bodega|celler|cave|vino|vins|vi-/, (n) => `Celler de ${n}`],
  [/cocina|cuina|kitchen|fogons/, (n) => `Cuina de ${n}`],
  [/chef|germans|equip|team|nosaltres|nosotros|quisom|qui-som|pierre|karine|castel/, (n) => `Equip de ${n}`],
  [
    /plato|plat|carta|menu|arros|arroz|chuleton|xuleto|trufa|tartar|gofre|guiso|carne|provoleta|mollejas|parrilla|fuego|queso|formatge|xai|cigrons|bikini|costella|comida|degustacio|trinxat|food/,
    (n) => `Un plat de ${n}`,
  ],
  [/sala|comedor|menjador|restaurante|restaurant|cadre|salle|espai|mesa|taula|bar/, (n) => `Sala de ${n}`],
];

function altFromFilename(url, name) {
  const file = decodeURIComponent(url).toLowerCase();
  for (const [pattern, build] of HINTS) {
    if (pattern.test(file)) return build(name);
  }
  return null;
}

function altFromCommons(title) {
  return title
    .replace(/^File:/, '')
    .replace(/\.(jpe?g|png|webp|tiff?)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    // Els noms de Commons sovint acaben amb la data i l'hora de la càmera
    // («… 20220724 095246»), que no descriu res a qui escolta la pàgina.
    .replace(/\b[A-Z]?\d{6,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.md'));

let touched = 0;
let total = 0;
const missing = [];

for (const file of files) {
  const path = join(CONTENT_DIR, file);
  const raw = await readFile(path, 'utf8');
  const match = raw.match(FRONTMATTER);
  if (!match) continue;

  const data = parse(match[1]);
  const slug = file.replace(/\.md$/, '');
  const entries = manifest[slug];

  if (!entries || entries.length === 0) {
    missing.push(slug);
    continue;
  }

  const name = data.name ?? slug;
  const town = data.town ?? 'la Cerdanya';

  // Diverses fotos d'una casa poden caure a la mateixa descripció; se'n desempaten
  // amb un ordinal perquè cap lector de pantalla senti tres cops la mateixa frase.
  const seen = new Map();

  data.images = entries.map((image) => {
    // El text alternatiu es dedueix de l'URL d'origen, no del camí de destí: el camí
    // de destí sempre conté «restaurants» i faria coincidir totes les fotos amb «sala».
    const alt = image.isOfficial
      ? (altFromFilename(image.originUrl ?? '', name) ?? `${name}, a ${town}`)
      : altFromCommons(image.commonsTitle ?? '') || `Paisatge de ${town}`;

    // Un títol de Commons curt («Alp») repetit amb el poble donava «Alp — Alp». Val més
    // situar-lo a la vall, que és informació i es llegeix com una frase.
    const base = alt.length >= 12 ? alt : `${alt}, a la Cerdanya`;
    const repeat = (seen.get(base) ?? 0) + 1;
    seen.set(base, repeat);

    return {
      src: image.src,
      alt: repeat === 1 ? base : `${base}, ${repeat}`,
      author: image.author,
      license: image.license,
      ...(image.licenseUrl ? { licenseUrl: image.licenseUrl } : {}),
      sourceUrl: image.sourceUrl,
      isOfficial: Boolean(image.isOfficial),
    };
  });

  total += data.images.length;
  touched += 1;

  const body = raw.slice(match[0].length);
  const yaml = stringify(data, { lineWidth: 0, defaultStringType: 'QUOTE_SINGLE', defaultKeyType: 'PLAIN' });
  await writeFile(path, `---\n${yaml}---\n\n${body.replace(/^\n+/, '')}`, 'utf8');
}

console.log(`✓ ${total} imatges acreditades a ${touched} fitxes`);
if (missing.length > 0) console.log(`· sense imatges al manifest: ${missing.join(', ')}`);
