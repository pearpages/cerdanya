#!/usr/bin/env node
/**
 * Construeix `src/data/valley-profile.json`: el tall longitudinal de la Cerdanya.
 *
 * És el perfil real del fons de vall, del Segre a Martinet fins a pujar a Font-Romeu,
 * mostrejat cada 250 m sobre el model digital del terreny. Sobre aquest perfil el lloc
 * hi situa cada poble a la seva cota. No és una il·lustració: són dades.
 *
 *   - traçat: polilínia pels nuclis del fons de vall (coordenades d'OpenStreetMap)
 *   - altitud: EU-DEM 25 m via api.opentopodata.org
 *
 * Ús: node scripts/build-valley-profile.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VILLAGES_IN = resolve(ROOT, 'src/data/villages.json');
const OUT = resolve(ROOT, 'src/data/valley-profile.json');

/**
 * Eix de la vall d'oest a est: el Segre des de Martinet, l'altiplà de Puigcerdà,
 * la frontera a Bourg-Madame i la pujada per Sallagosa cap al replà de Font-Romeu.
 */
const AXIS = [
  [42.3605, 1.6944], // Martinet
  [42.3702, 1.7745], // Bellver de Cerdanya
  [42.3781, 1.8176], // Isòvol
  [42.4116, 1.8472], // Ger
  [42.4179, 1.8798], // Bolvir
  [42.4318, 1.9279], // Puigcerdà
  [42.4349, 1.9438], // Bourg-Madame — la ratlla
  [42.4633, 1.9382], // Ur
  [42.4687, 1.9961], // Estavar
  [42.4589, 2.0396], // Sallagosa
  [42.505, 2.042], // Font-Romeu
];

const STEP_M = 250;
const EARTH_R = 6371008.8;

const rad = (d) => (d * Math.PI) / 180;

function haversine([lat1, lon1], [lat2, lon2]) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

/** Reparteix punts equidistants al llarg de la polilínia. */
function densify(axis, stepM) {
  const points = [];
  let carry = 0;
  let travelled = 0;

  points.push({ lat: axis[0][0], lng: axis[0][1], distance: 0 });

  for (let i = 0; i < axis.length - 1; i += 1) {
    const from = axis[i];
    const to = axis[i + 1];
    const segment = haversine(from, to);
    let along = stepM - carry;

    while (along <= segment) {
      const t = along / segment;
      points.push({
        lat: from[0] + (to[0] - from[0]) * t,
        lng: from[1] + (to[1] - from[1]) * t,
        distance: travelled + along,
      });
      along += stepM;
    }

    carry = segment - (along - stepM);
    travelled += segment;
  }

  return points;
}

const CHUNK = 90;

async function elevations(points) {
  const out = [];
  for (let i = 0; i < points.length; i += CHUNK) {
    const batch = points.slice(i, i + CHUNK);
    const locations = batch.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
    const res = await fetch(
      `https://api.opentopodata.org/v1/eudem25m?locations=${encodeURIComponent(locations)}`,
    );
    if (!res.ok) throw new Error(`opentopodata ha respost ${res.status}`);
    const body = await res.json();
    if (body.status !== 'OK') throw new Error(`opentopodata: ${body.error ?? body.status}`);
    out.push(...body.results.map((r) => r.elevation));
    process.stdout.write(`  ${Math.min(i + CHUNK, points.length)}/${points.length}\r`);
    if (i + CHUNK < points.length) await new Promise((r) => setTimeout(r, 1200));
  }
  return out;
}

const samples = densify(AXIS, STEP_M);
console.log(`Mostrejant ${samples.length} punts cada ${STEP_M} m…`);
const eles = await elevations(samples);
console.log('');

const profile = samples.map((p, i) => ({
  km: Number((p.distance / 1000).toFixed(3)),
  ele: Math.round(eles[i]),
  lat: Number(p.lat.toFixed(5)),
  lng: Number(p.lng.toFixed(5)),
}));

/** Projecta cada poble sobre el punt del perfil que li queda més a prop. */
const { villages } = JSON.parse(await readFile(VILLAGES_IN, 'utf8'));
const placed = villages
  .map((v) => {
    let best = null;
    for (const p of profile) {
      const d = haversine([v.lat, v.lng], [p.lat, p.lng]);
      if (!best || d < best.offset) best = { km: p.km, offset: d };
    }
    return {
      name: v.name,
      subregion: v.subregion,
      country: v.country,
      elevation: v.elevation,
      km: best.km,
      /** Distància del poble a l'eix de la vall: diu si és de fons de vall o de vessant. */
      offsetKm: Number((best.offset / 1000).toFixed(2)),
    };
  })
  .sort((a, b) => a.km - b.km);

const eleValues = profile.map((p) => p.ele);
const meta = {
  stepMetres: STEP_M,
  lengthKm: profile.at(-1).km,
  minEle: Math.min(...eleValues, ...placed.map((p) => p.elevation)),
  maxEle: Math.max(...eleValues, ...placed.map((p) => p.elevation)),
};

await writeFile(
  OUT,
  `${JSON.stringify(
    {
      _source: {
        axis: 'Polilínia pel fons de vall — coordenades d’OpenStreetMap (ODbL)',
        elevation: 'EU-DEM 25 m via api.opentopodata.org',
        generatedBy: 'scripts/build-valley-profile.mjs',
      },
      meta,
      profile,
      villages: placed,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`✓ tall de ${meta.lengthKm} km · ${meta.minEle}–${meta.maxEle} m → src/data/valley-profile.json`);
