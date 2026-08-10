#!/usr/bin/env node
/**
 * Aboca `data/location-manifest.json` al frontmatter de cada fitxa.
 *
 * L'esquema ja declarava `lat` i `lng` opcionals des del principi i cap fitxa no els
 * omplia. Aquí és on deixen de ser una promesa: la fitxa és la font de veritat i el que
 * llegeixen les pàgines, com passa amb `images[]` i `apply-image-credits.mjs`.
 *
 * La resta del manifest —d'on surt el punt i si és la porta o el centre del poble— no
 * hi baixa: és metadada del pipeline, la fa servir la pàgina llegint el manifest, i
 * repetir-la a 44 fitxes només serviria per fer-la divergir.
 *
 * Ús: node scripts/apply-locations.mjs
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = resolve(ROOT, 'src/content/restaurants');
const MANIFEST = resolve(ROOT, 'data/location-manifest.json');

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

const { locations } = JSON.parse(await readFile(MANIFEST, 'utf8'));
const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.md'));

let touched = 0;
const missing = [];

for (const file of files) {
  const path = join(CONTENT_DIR, file);
  const raw = await readFile(path, 'utf8');
  const match = raw.match(FRONTMATTER);
  if (!match) continue;

  const slug = file.replace(/\.md$/, '');
  const place = locations[slug];

  if (!place) {
    missing.push(slug);
    continue;
  }

  const data = parse(match[1]);

  // Sis decimals són ~11 cm: més xifres serien precisió inventada, i el que hi ha a
  // sota és un node d'OSM posat a mà per algú.
  const lat = Number(place.lat.toFixed(6));
  const lng = Number(place.lng.toFixed(6));

  // Assignar-los i prou els deixaria al final del frontmatter, després de les imatges.
  // L'esquema els declara al costat d'`address` i és on els busca qui obre el fitxer,
  // així que es reconstrueix l'objecte per posar-los al seu lloc.
  const ordered = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'lat' || key === 'lng' || key === 'locationNote') continue;
    ordered[key] = value;
    if (key === 'address') {
      ordered.lat = lat;
      ordered.lng = lng;
      if (place.readerNote) ordered.locationNote = place.readerNote;
    }
  }
  if (!('lat' in ordered)) {
    ordered.lat = lat;
    ordered.lng = lng;
    if (place.readerNote) ordered.locationNote = place.readerNote;
  }

  const body = raw.slice(match[0].length);
  const yaml = stringify(ordered, { lineWidth: 0, defaultStringType: 'QUOTE_SINGLE', defaultKeyType: 'PLAIN' });
  await writeFile(path, `---\n${yaml}---\n\n${body.replace(/^\n+/, '')}`, 'utf8');
  touched += 1;
}

console.log(`✓ coordenades a ${touched} fitxes`);
if (missing.length > 0) {
  console.log(`· sense punt al manifest: ${missing.join(', ')} — executa npm run data:locations`);
}
