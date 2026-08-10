#!/usr/bin/env node
/**
 * Dibuixa el mapa de cada fitxa a `src/assets/maps/<slug>.webp`.
 *
 * Cus els tiles d'OpenStreetMap al voltant del punt que ha trobat `build-locations.mjs`
 * i hi clava la xinxeta. La imatge es commiteja i es publica com una foto qualsevol: la
 * fitxa no demana res a cap servidor extern quan algú la llegeix, que és el mateix tracte
 * que tenen les fotografies i el que fa que el lloc no segueixi ningú.
 *
 * Els tiles es demanen a zoom 17 i la imatge es mostra a mitja mida, o sigui que es veu
 * a zoom 16 amb el doble de densitat: nítida a les pantalles bones sense haver de baixar
 * el doble de tiles.
 *
 * El cau de `data/tiles/` no es commiteja però és el que fa que tornar a generar un mapa
 * no costi cap petició. Esborrar-lo vol dir tornar a demanar ~1.300 tiles al servidor
 * d'OSM, que ens els deixa de franc: no ho facis sense motiu.
 *
 * Ús: node scripts/render-maps.mjs [--only slug,slug] [--force]
 * No s'executa durant el build; la sortida es commiteja i es repassa a ull.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = resolve(ROOT, 'data/location-manifest.json');
const CACHE_DIR = resolve(ROOT, 'data/tiles');
const OUT_DIR = resolve(ROOT, 'src/assets/maps');

const UA = 'cota-de-tast/0.1 (guia gastronomica de la Cerdanya; contacte: pere@soms.cat)';
const TILE_URL = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/** Una petició per segon. El servidor de tiles d'OSM és un bé comú i el paga algú altre. */
const THROTTLE_MS = 1000;

const TILE = 256;
const ZOOM = 17;
/** Mida en píxels de dispositiu; es mostra a la meitat (720×405 CSS). */
const WIDTH = 1440;
const HEIGHT = 810;

/**
 * L'or de l'accent, copiat de `--c-forn` a src/styles/tokens.css.
 * És l'únic color del lloc que no pot sortir dels tokens: això és un ràster i no sap
 * res de temes. Si algun dia canvia l'accent, canvia'l aquí i torna a generar els mapes.
 */
const ACCENT = '#f2a20c';
const INK = '#061420';

const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const force = args.includes('--force');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/* ---- Web Mercator -------------------------------------------------------- */

function lngToX(lng, z) {
  return ((lng + 180) / 360) * 2 ** z * TILE;
}

function latToY(lat, z) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z * TILE;
}

/* ---- Tiles --------------------------------------------------------------- */

let lastCall = 0;
let fetched = 0;
let cached = 0;

async function tile(z, x, y) {
  const path = join(CACHE_DIR, `${z}`, `${x}`, `${y}.png`);
  if (await exists(path)) {
    cached += 1;
    return readFile(path);
  }

  const wait = THROTTLE_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const res = await fetch(TILE_URL(z, x, y), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`El tile ${z}/${x}/${y} ha respost ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  fetched += 1;
  return buffer;
}

/**
 * La xinxeta: una gota amb vora fosca perquè es llegeixi tant sobre el verd d'un prat
 * com sobre el gris d'un carrer. L'or ja vol dir «això és el que mires» a la frontera i
 * al poble de la fitxa del tall de la vall; aquí vol dir el mateix.
 */
function pin() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="92" viewBox="0 0 36 46">
    <path d="M18 45C18 45 34 26.5 34 17A16 16 0 1 0 2 17C2 26.5 18 45 18 45Z"
          fill="${ACCENT}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="18" cy="17" r="5.5" fill="${INK}"/>
  </svg>`;
  return Buffer.from(svg);
}

/* ---- Un mapa per casa ---------------------------------------------------- */

const { locations } = JSON.parse(await readFile(MANIFEST, 'utf8'));
await mkdir(OUT_DIR, { recursive: true });

const entries = Object.entries(locations).filter(([slug]) => !only || only.has(slug));
let written = 0;
let skipped = 0;

for (const [slug, place] of entries) {
  const out = join(OUT_DIR, `${slug}.webp`);
  if (!force && (await exists(out))) {
    skipped += 1;
    continue;
  }

  const zoom = place.zoom ?? ZOOM;
  const cx = lngToX(place.lng, zoom);
  const cy = latToY(place.lat, zoom);
  const left = cx - WIDTH / 2;
  const top = cy - HEIGHT / 2;

  const x0 = Math.floor(left / TILE);
  const x1 = Math.floor((left + WIDTH - 1) / TILE);
  const y0 = Math.floor(top / TILE);
  const y1 = Math.floor((top + HEIGHT - 1) / TILE);

  const composite = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      composite.push({
        input: await tile(zoom, x, y),
        left: Math.round(x * TILE - left),
        top: Math.round(y * TILE - top),
      });
    }
  }

  // La punta de la gota ha de caure damunt del punt, no el seu centre.
  composite.push({ input: pin(), left: Math.round(WIDTH / 2 - 36), top: Math.round(HEIGHT / 2 - 92) });

  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#f2efe9' },
  })
    .composite(composite)
    .webp({ quality: 82 })
    .toFile(out);

  written += 1;
  console.log(`  · ${slug} — ${place.matchType} (${composite.length - 1} tiles)`);
}

console.log(`\n✓ ${written} mapes → src/assets/maps/`);
console.log(`  ${fetched} tiles demanats a OSM, ${cached} del cau${skipped ? `, ${skipped} ja fets` : ''}`);
if (skipped > 0) console.log('  Fes servir --force per tornar-los a dibuixar.');
