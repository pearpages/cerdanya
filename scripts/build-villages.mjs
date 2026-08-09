#!/usr/bin/env node
/**
 * Construeix `src/data/villages.json`: coordenades i altitud de cada poble on hi ha
 * un restaurant de la guia.
 *
 * L'altitud és l'eix estructural del lloc, així que no es pot inventar. Ve de dues
 * fonts obertes i citables:
 *   - coordenades: OpenStreetMap (ODbL) — © contribuïdors d'OpenStreetMap
 *   - altitud: EU-DEM 25 m via api.opentopodata.org, amb SRTM 30 m de reserva
 *
 * Ús: node scripts/build-villages.mjs
 * És idempotent i no s'executa durant el build; la sortida es commiteja.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/villages.json');

/**
 * Coordenades preses dels nodes `place` d'OpenStreetMap dins la caixa de la Cerdanya
 * (42.28,1.60 → 42.68,2.25) i, per als tres que no hi tenien node, de Nominatim.
 * `subregion` segueix la divisió real: la frontera parteix l'altiplà i Llívia és un
 * enclavament espanyol envoltat de França.
 */
const VILLAGES = [
  // --- Baixa Cerdanya (Espanya) ---
  { name: 'Alp', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3736, lng: 1.8872 },
  { name: 'All', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3976, lng: 1.8384 },
  { name: 'Bellver de Cerdanya', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3702, lng: 1.7745 },
  { name: 'Bolvir', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.4179, lng: 1.8798 },
  { name: 'Bor', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3467, lng: 1.8022 },
  { name: 'Das', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3636, lng: 1.8713 },
  { name: 'Estoll', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.386, lng: 1.8861 },
  { name: 'Fontanals de Cerdanya', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3845, lng: 1.9113 },
  { name: 'Ger', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.4116, lng: 1.8472 },
  { name: 'Guils de Cerdanya', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.4479, lng: 1.8797 },
  { name: 'Isòvol', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3781, lng: 1.8176 },
  { name: 'Lles de Cerdanya', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3904, lng: 1.6876 },
  { name: 'Martinet', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3605, lng: 1.6944 },
  { name: 'Meranges', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.4461, lng: 1.787 },
  { name: 'Montellà', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3545, lng: 1.7049 },
  { name: 'Olopte', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3935, lng: 1.816 },
  { name: 'Prullans', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3803, lng: 1.7365 },
  { name: 'Puigcerdà', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.4318, lng: 1.9279 },
  { name: 'Queixans', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3975, lng: 1.9202 },
  { name: 'Riu de Cerdanya', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3452, lng: 1.8261 },
  { name: 'Sanavastre', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3855, lng: 1.8505 },
  { name: 'Talltendre', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.4035, lng: 1.7655 },
  { name: 'Travesseres', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3752, lng: 1.688 },
  { name: 'Urtx', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.3874, lng: 1.9102 },
  { name: 'Urús', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.352, lng: 1.8534 },
  { name: 'Vilallobent', subregion: 'Baixa Cerdanya', country: 'ES', lat: 42.4079, lng: 1.9521 },

  // --- Llívia (enclavament espanyol dins França) ---
  { name: 'Llívia', subregion: 'Llívia', country: 'ES', lat: 42.4641, lng: 1.9804 },

  // --- Alta Cerdanya (França) ---
  { name: 'Angostrina', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.485, lng: 1.9611 },
  { name: 'Bourg-Madame', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.4349, lng: 1.9438 },
  { name: 'Èguet', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.5005, lng: 2.0169 },
  { name: 'Enveig', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.4597, lng: 1.9154 },
  { name: 'Er', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.4407, lng: 2.0329 },
  { name: 'Estavar', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.4687, lng: 1.9961 },
  { name: 'Eina', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.4736, lng: 2.0816 },
  { name: 'Font-Romeu', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.505, lng: 2.042 },
  { name: 'Llo', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.4553, lng: 2.0618 },
  { name: 'Oceja', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.4151, lng: 1.9811 },
  { name: 'Sallagosa', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.4589, lng: 2.0396 },
  { name: 'Targasona', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.4994, lng: 1.9965 },
  { name: 'Ur', subregion: 'Alta Cerdanya', country: 'FR', lat: 42.4633, lng: 1.9382 },
];

const CHUNK = 90;

async function elevationsFor(points, dataset) {
  const out = [];
  for (let i = 0; i < points.length; i += CHUNK) {
    const batch = points.slice(i, i + CHUNK);
    const locations = batch.map((p) => `${p.lat},${p.lng}`).join('|');
    const url = `https://api.opentopodata.org/v1/${dataset}?locations=${encodeURIComponent(locations)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${dataset} ha respost ${res.status}`);
    const body = await res.json();
    if (body.status !== 'OK') throw new Error(`${dataset}: ${body.error ?? body.status}`);
    out.push(...body.results.map((r) => r.elevation));
    if (i + CHUNK < points.length) await new Promise((r) => setTimeout(r, 1200));
  }
  return out;
}

const primary = await elevationsFor(VILLAGES, 'eudem25m');
// EU-DEM no cobreix tot; on falti, es reintenta amb SRTM.
const gaps = VILLAGES.map((_, i) => i).filter((i) => primary[i] == null);
if (gaps.length > 0) {
  const fallback = await elevationsFor(
    gaps.map((i) => VILLAGES[i]),
    'srtm30m',
  );
  gaps.forEach((idx, k) => {
    primary[idx] = fallback[k];
  });
}

const villages = VILLAGES.map((v, i) => {
  const elevation = primary[i];
  if (elevation == null) throw new Error(`Sense altitud per a ${v.name}`);
  return { ...v, elevation: Math.round(elevation) };
}).sort((a, b) => a.elevation - b.elevation);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  `${JSON.stringify(
    {
      _source: {
        coordinates: 'OpenStreetMap (ODbL) — © contribuïdors d’OpenStreetMap',
        elevation: 'EU-DEM 25 m via api.opentopodata.org (SRTM 30 m de reserva)',
        generatedBy: 'scripts/build-villages.mjs',
      },
      villages,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`✓ ${villages.length} pobles → src/data/villages.json`);
console.log(
  `  de ${villages[0].name} (${villages[0].elevation} m) a ${villages.at(-1).name} (${villages.at(-1).elevation} m)`,
);
