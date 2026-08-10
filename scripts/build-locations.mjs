#!/usr/bin/env node
/**
 * Geocodifica les fitxes i escriu `data/location-manifest.json`: un punt per casa.
 *
 * L'esquema ja preveia `lat`/`lng` i ningú no els havia omplert mai. D'aquí surten el
 * mapa de la fitxa (`render-maps.mjs`) i les coordenades del frontmatter
 * (`apply-locations.mjs`).
 *
 * Es prova dues vegades per casa, i la primera que encerti mana:
 *   1. el punt d'interès: Nominatim per nom i adreça, i només val si el que torna és
 *      un lloc de menjar (`amenity=restaurant`, `bar`, `hotel`…). És l'única passada
 *      que pot caure damunt de la casa i no al mig del carrer.
 *   2. l'adreça postal: cerca estructurada (carrer, codi postal, municipi).
 * Si cap no encerta, el punt cau al centre del poble i queda marcat `village`, que la
 * fitxa diu en veu alta en comptes de dibuixar una precisió que no té.
 *
 * `data/location-picks.json` mana per damunt de tot: el que hi ha fixat a mà ni es
 * consulta. És on aterren les cases que la geocodificació no sap resoldre, igual que
 * `image-picks.json` ho és per a les fotos.
 *
 * Ús: node scripts/build-locations.mjs [--only slug,slug]
 * No s'executa durant el build; la sortida es commiteja i es repassa a ull.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = resolve(ROOT, 'src/content/restaurants');
const VILLAGES_IN = resolve(ROOT, 'src/data/villages.json');
const PICKS = resolve(ROOT, 'data/location-picks.json');
const OUT = resolve(ROOT, 'data/location-manifest.json');

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

const UA = 'cota-de-tast/0.1 (guia gastronomica de la Cerdanya; contacte: pere@soms.cat)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

/**
 * Nominatim demana una petició per segon com a màxim. No és una recomanació: és la
 * condició d'ús del servei, i saltar-se-la ens deixaria fora a tots.
 */
const THROTTLE_MS = 1100;

/** Com de lluny del seu poble pot caure un punt abans de considerar-lo un error. */
const MAX_DRIFT_KM = 3;

/**
 * Què compta com a «ha trobat la casa» i no un carrer qualsevol amb el mateix nom.
 * Els hotels i els cellers hi són perquè de la guia n'hi ha uns quants que a OSM
 * consten com a `tourism=hotel` amb el restaurant a dins.
 */
const POI_CLASSES = new Set(['amenity', 'tourism', 'shop', 'leisure']);
const POI_TYPES = new Set([
  'restaurant',
  'fast_food',
  'cafe',
  'bar',
  'pub',
  'bistro',
  'hotel',
  'guest_house',
  'chalet',
  'hostel',
  'bakery',
  'deli',
  'food',
  'ice_cream',
  'winery',
]);

const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastCall = 0;
async function nominatim(params) {
  const wait = THROTTLE_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const url = `${NOMINATIM}?${new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    ...params,
  })}`;

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Nominatim ha respost ${res.status} — ${url}`);
  return res.json();
}

const rad = (d) => (d * Math.PI) / 180;

/** Distància en km entre dos punts. Serveix per saber si un resultat és creïble. */
function haversine(a, b) {
  const R = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Parteix l'adreça en els trossos que Nominatim sap fer servir per separat.
 * Les adreces del lloc segueixen totes la forma «Carrer, número, [llogaret,] CP Municipi»,
 * amb la variant francesa «12 rue Tal, 66120 Municipi».
 */
function splitAddress(address) {
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  // L'últim tros porta el codi postal i el municipi; el guionet de «Puigcerdà — a
  // l'estany» és un aclariment per a qui llegeix, no part de l'adreça.
  const tail = parts.at(-1)?.replace(/\s*—.*$/, '') ?? '';
  const postal = tail.match(/\b(\d{5})\b/)?.[1] ?? '';
  const city = tail.replace(/\b\d{5}\b/, '').trim();

  const head = parts.slice(0, -1);
  // A l'estat espanyol el número va en un tros a part («Carrer Major, 12»); al francès
  // va enganxat davant («12 rue Tal»). Nominatim entén les dues formes al camp `street`.
  const street = head.length > 1 && /^\d+[a-zA-Z]?$/.test(head[1]) ? `${head[1]} ${head[0]}` : head[0];

  return { street: street ?? '', city, postal };
}

function isPoi(hit) {
  return POI_CLASSES.has(hit.category ?? hit.class) && POI_TYPES.has(hit.type);
}

/* ---- Entrada ------------------------------------------------------------ */

const { villages } = JSON.parse(await readFile(VILLAGES_IN, 'utf8'));
const villageByName = new Map(villages.map((v) => [v.name, v]));

let picks = {};
try {
  picks = JSON.parse(await readFile(PICKS, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.md')).sort();

/* ---- Una casa rere l'altra ---------------------------------------------- */

const locations = {};
const problems = [];
const tally = { manual: 0, poi: 0, address: 0, village: 0 };

for (const file of files) {
  const slug = file.replace(/\.md$/, '');
  if (only && !only.has(slug)) continue;

  const raw = await readFile(join(CONTENT_DIR, file), 'utf8');
  const data = parse(raw.match(FRONTMATTER)[1]);

  const village = villageByName.get(data.town);
  if (!village) {
    throw new Error(
      `${slug}: el poble «${data.town}» no és a src/data/villages.json — cal afegir-l'hi a scripts/build-villages.mjs i tornar a executar npm run data:villages`,
    );
  }

  const pick = picks[slug];
  if (pick) {
    locations[slug] = {
      name: data.name,
      town: data.town,
      address: data.address,
      lat: pick.lat,
      lng: pick.lng,
      matchType: 'manual',
      matchedName: pick.note ?? 'fixat a mà',
      // Fixar-lo a mà no vol dir encertar la porta: Mooma seu a l'aeròdrom i el punt
      // n'és el centre. Qui fixa el punt ho diu amb `approxNote`, que és el que llegirà
      // qui obri la fitxa; `note` és per a nosaltres i diu d'on l'hem tret.
      precise: !pick.approxNote,
      ...(pick.approxNote ? { readerNote: pick.approxNote } : {}),
    };
    tally.manual += 1;
    console.log(`  · ${slug} — fixat a mà${pick.approxNote ? ' (aproximat)' : ''}`);
    continue;
  }

  const { street, city, postal } = splitAddress(data.address);
  let found = null;

  // 1) El punt d'interès: «nom, poble» i prou. Passar-hi l'adreça sencera fa que
  //    Nominatim no trobi res —«Can Ventura, Plaça Major, 1, 17527 Llívia» torna zero
  //    resultats i «Can Ventura, Llívia» torna el node del restaurant—, perquè la cerca
  //    lliure vol que tots els trossos quadrin i el número de portal del node no hi és.
  //    Els noms alternatius hi entren perquè a OSM la casa hi consta sovint amb el nom
  //    comercial; el municipi de l'adreça també, per als llogarets com Bor o Gorguja,
  //    que a OSM pengen del municipi gran.
  //
  //    L'última provatura és el nom tot sol, sense lloc. Cal perquè el lloc també
  //    exclou encerts: «la Borda del Ceretà, Puigcerdà» no torna res perquè a OSM el
  //    node cau dins de Sant Martí d'Aravó, i el nom sol el troba. Obrir-ho tant només
  //    és segur perquè cap candidat s'accepta si no cau a prop del poble de la fitxa.
  const names = [data.name, ...(data.altNames ?? [])];
  const places = city && city !== data.town ? [data.town, city] : [data.town];

  for (const name of names) {
    for (const place of [...places, null]) {
      const hits = await nominatim({
        q: place ? `${name}, ${place}` : name,
        countrycodes: data.country.toLowerCase(),
      });
      const hit = hits.find(
        (h) => isPoi(h) && haversine({ lat: Number(h.lat), lng: Number(h.lon) }, village) <= MAX_DRIFT_KM,
      );
      if (hit) {
        found = {
          lat: Number(hit.lat),
          lng: Number(hit.lon),
          matchType: 'poi',
          matchedName: hit.display_name,
        };
        break;
      }
    }
    if (found) break;
  }

  // 2) L'adreça postal, que aterra al portal o al mig del carrer.
  if (!found && street) {
    const hits = await nominatim({
      street,
      city,
      ...(postal ? { postalcode: postal } : {}),
      countrycodes: data.country.toLowerCase(),
    });
    const hit = hits[0];
    if (hit) {
      found = {
        lat: Number(hit.lat),
        lng: Number(hit.lon),
        matchType: 'address',
        matchedName: hit.display_name,
      };
    }
  }

  // 3) El centre del poble. No és la casa i la fitxa ho dirà.
  if (!found) {
    found = {
      lat: village.lat,
      lng: village.lng,
      matchType: 'village',
      matchedName: `centre de ${village.name}`,
    };
  }

  // Un resultat lluny del seu poble vol dir que Nominatim ha trobat un carrer amb el
  // mateix nom en una altra comarca. Val més aturar-se que publicar-lo.
  const drift = haversine(found, village);
  if (drift > MAX_DRIFT_KM) {
    problems.push(
      `${slug} («${data.name}»): el punt cau a ${drift.toFixed(1)} km de ${village.name} — ${found.matchedName}`,
    );
  }

  locations[slug] = {
    name: data.name,
    town: data.town,
    address: data.address,
    lat: found.lat,
    lng: found.lng,
    matchType: found.matchType,
    matchedName: found.matchedName,
    driftKm: Number(drift.toFixed(3)),
    // El centre del poble no és la casa: la fitxa ho ha de dir en comptes de dibuixar
    // una precisió que no tenim.
    precise: found.matchType !== 'village',
    ...(found.matchType === 'village'
      ? {
          readerNote: `El punt és el centre de ${village.name}: d’aquesta casa no en consta l’adreça exacta al mapa.`,
        }
      : {}),
  };
  tally[found.matchType] += 1;

  console.log(`  · ${slug} — ${found.matchType} (${drift.toFixed(2)} km del poble)`);
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} punt/s massa lluny del seu poble:\n`);
  for (const problem of problems) console.error(`  · ${problem}`);
  console.error(
    `\nCap punt es publica a més de ${MAX_DRIFT_KM} km del seu poble. Busca la casa a un mapa i fixa-la a data/location-picks.json:\n` +
      `  { "<slug>": { "lat": 42.4, "lng": 1.9, "note": "d'on l'has tret" } }\n`,
  );
  process.exit(1);
}

/* ---- Sortida ------------------------------------------------------------ */

await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  `${JSON.stringify(
    {
      _source: {
        coordinates: 'Nominatim / OpenStreetMap (ODbL) — © col·laboradors d’OpenStreetMap',
        copyright: 'https://www.openstreetmap.org/copyright',
        generatedBy: 'scripts/build-locations.mjs',
      },
      locations,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

const total = Object.keys(locations).length;
console.log(`\n✓ ${total} punts → data/location-manifest.json`);
console.log(
  `  ${tally.poi} sobre la casa · ${tally.address} per adreça · ${tally.village} al centre del poble · ${tally.manual} a mà`,
);
if (tally.address + tally.village > 0) {
  console.log('  Repassa les que no són «poi»: són les que poden caure al carrer del costat.');
}
