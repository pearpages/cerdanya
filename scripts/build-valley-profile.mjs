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
 * A més de l'eix principal en mostreja els esperons: les valls laterals que s'hi enfilen
 * i que hi tenen restaurants. Sense això els seus pobles projecten damunt del punt on la
 * vall desemboca i queden surant centenars de metres per damunt del fons de vall.
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

/**
 * Valls laterals que el tall dibuixa com a esperó, ordenades **des de la confluència cap
 * enfora**: així la distància mostrejada és «quilòmetres vall amunt» i el component les
 * pot desplegar cap enrere de l'eix principal.
 *
 * De moment només n'hi ha una. La vall de Lles desemboca al Segre justament a Martinet,
 * el quilòmetre zero, i s'hi enfilen dos pobles amb restaurant: Travesseres i Lles de
 * Cerdanya. Sense l'esperó tots dos projecten damunt del quilòmetre zero i queden surant
 * a la vora del dibuix, 200 i 490 m per damunt del fons de vall.
 */
const TRIBUTARIES = [
  {
    name: 'Vall de Lles',
    axis: [
      [42.3605, 1.6944], // Martinet — la confluència
      [42.3752, 1.688], // Travesseres
      [42.3904, 1.6876], // Lles de Cerdanya
    ],
  },
];

const STEP_M = 250;
const EARTH_R = 6371008.8;

/**
 * El passadís: a cada mostra de l'eix es mesura també el terreny cap als dos costats, i
 * se'n guarda la cota **màxima** de cada banda. D'aquí surten les muntanyes del tall.
 *
 * Un poble de vessant seu a la seva cota i el perfil de l'eix és el fons de vall a
 * quilòmetres d'allà: dibuixat només l'eix, tretze dels disset punts suren damunt del no
 * res —Urús, dos-cents metres. El que hi ha entremig no és buit, és muntanya, i això la
 * mesura.
 *
 * `SWATH_M` no és arbitrari: dels pobles que es dibuixen, el més lluny de l'eix és Alp, a
 * 4,92 km. Amb un passadís més estret la seva cota passaria per damunt de la carena i
 * tornaríem a tenir un punt surant, ara pitjor. La comprovació de més avall no deixa que
 * passi desapercebut.
 */
const SWATH_M = 5000;
const SWATH_STEP_M = 250;
/** La banda de dins: el vessant immediat, on seuen els pobles de fons de vall. */
const SHOULDER_M = 1500;

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

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

/** Llargada total d'una polilínia, en metres. */
function axisLength(axis) {
  let total = 0;
  for (let i = 0; i < axis.length - 1; i += 1) total += haversine(axis[i], axis[i + 1]);
  return total;
}

/**
 * Direcció local de la polilínia ja densificada, en metres i normalitzada. Per
 * diferències finites entre els veïns; als extrems, amb el segment que hi toca.
 */
function heading(points, i) {
  const from = points[Math.max(0, i - 1)];
  const to = points[Math.min(points.length - 1, i + 1)];
  const mid = rad((from.lat + to.lat) / 2);
  const dx = rad(to.lng - from.lng) * Math.cos(mid) * EARTH_R;
  const dy = rad(to.lat - from.lat) * EARTH_R;
  const norm = Math.hypot(dx, dy) || 1;
  return { dx: dx / norm, dy: dy / norm };
}

/**
 * Els punts del passadís d'una mostra: perpendicular a l'eix, cap als dos costats, cada
 * `SWATH_STEP_M` fins a `SWATH_M`. Surten ordenats per distància i amb el signe de la
 * banda, però el dibuix només en fa servir el màxim: quina de les dues vores de la vall
 * és la que s'enfila no ho diu, i a l'esperó de Lles —que va de sud a nord— «nord» i
 * «sud» ja no voldrien dir el mateix que a l'eix principal.
 */
function swathOf(points, i) {
  const { dx, dy } = heading(points, i);
  const p = points[i];
  const out = [];
  for (let d = SWATH_STEP_M; d <= SWATH_M; d += SWATH_STEP_M) {
    for (const side of [1, -1]) {
      // Perpendicular a (dx, dy): (-dy, dx).
      const mx = -dy * d * side;
      const my = dx * d * side;
      out.push({
        lat: p.lat + deg(my / EARTH_R),
        lng: p.lng + deg(mx / (EARTH_R * Math.cos(rad(p.lat)))),
        distance: d,
      });
    }
  }
  return out;
}

/** Punt d'un perfil ja mostrejat més proper a unes coordenades. */
function project([lat, lng], samples) {
  let best = null;
  for (const p of samples) {
    const offset = haversine([lat, lng], [p.lat, p.lng]);
    if (!best || offset < best.offset) best = { km: p.km, offset };
  }
  return best;
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

const mainSamples = densify(AXIS, STEP_M);

/**
 * `densify()` només deixa punts als múltiples del pas i es menja el vèrtex final. A l'eix
 * principal no es nota, però a un esperó sí: la línia s'aturaria abans d'arribar al poble
 * de la punta, que és justament el que hi anem a buscar.
 */
const tributarySamples = TRIBUTARIES.map(({ axis }) => {
  const points = densify(axis, STEP_M);
  const total = axisLength(axis);
  if (total - points.at(-1).distance > 1) {
    points.push({ lat: axis.at(-1)[0], lng: axis.at(-1)[1], distance: total });
  }
  return points;
});

/**
 * Una sola tanda de peticions per a tots els traçats: així l'esperó no en gasta cap de
 * més. Cada mostra de l'eix hi va seguida dels seus punts de passadís, i el cursor de
 * `toProfile()` recorre la resposta en el mateix ordre.
 */
const traces = [mainSamples, ...tributarySamples];
const swaths = traces.map((points) => points.map((_, i) => swathOf(points, i)));
const everySample = traces.flatMap((points, t) =>
  points.flatMap((p, i) => [p, ...swaths[t][i]]),
);

const axisCount = traces.reduce((n, points) => n + points.length, 0);
console.log(
  `Mostrejant ${everySample.length} punts: ${axisCount} a l'eix cada ${STEP_M} m i ${everySample.length - axisCount} al passadís de ±${SWATH_M / 1000} km…`,
);
const eles = await elevations(everySample);
console.log('');

let cursor = 0;
const toProfile = (points, t) =>
  points.map((p, i) => {
    const ele = Math.round(eles[cursor++]);
    const flank = swaths[t][i].map((q) => ({ distance: q.distance, ele: eles[cursor++] }));

    /**
     * La cota del terreny compta com a candidata: el vessant no pot quedar per sota del
     * fons de vall ni la carena per sota del vessant, i al mig de l'altiplà de Puigcerdà
     * el terreny del voltant a estones és més baix que l'eix.
     */
    const highest = (within) =>
      Math.round(Math.max(ele, ...flank.filter((q) => q.distance <= within).map((q) => q.ele)));

    return {
      km: Number((p.distance / 1000).toFixed(3)),
      ele,
      /** Cota màxima del terreny a ≤1,5 km de l'eix: el vessant immediat. */
      shoulderEle: highest(SHOULDER_M),
      /** Cota màxima a ≤5 km: la carena que tanca la vall. */
      crestEle: highest(SWATH_M),
      lat: Number(p.lat.toFixed(5)),
      lng: Number(p.lng.toFixed(5)),
    };
  });

const profile = toProfile(mainSamples, 0);

/**
 * Els esperons porten el quilometratge comptat des de la confluència cap enfora, i
 * `joinKm` diu on desemboquen a l'eix principal. El tall els desplega cap enrere des
 * d'aquell punt.
 */
const tributaries = TRIBUTARIES.map((trib, i) => {
  const tribProfile = toProfile(tributarySamples[i], i + 1);

  /**
   * Pujant una vall lateral des de la confluència, el terreny no pot baixar. Si baixa és
   * que la recta entre dos nuclis ha creuat una carena i el que s'ha mostrejat no és el
   * fons de la vall sinó el vessant de la del costat — que dibuixat fa un pic inventat.
   * A l'eix principal aquesta comprovació no s'hi pot fer: el Segre baixa de debò.
   */
  for (let j = 1; j < tribProfile.length; j += 1) {
    const drop = tribProfile[j - 1].ele - tribProfile[j].ele;
    if (drop > 20) {
      throw new Error(
        `${trib.name}: el terreny baixa ${drop} m al km ${tribProfile[j].km} — la polilínia creua una carena, cal un vèrtex al mig`,
      );
    }
  }

  return {
    name: trib.name,
    joinKm: project(trib.axis[0], profile).km,
    lengthKm: tribProfile.at(-1).km,
    profile: tribProfile,
  };
});

/** Projecta cada poble sobre el punt del perfil que li queda més a prop. */
const { villages } = JSON.parse(await readFile(VILLAGES_IN, 'utf8'));
const placed = villages
  .map((v) => {
    const main = project([v.lat, v.lng], profile);

    /**
     * Un poble pot quedar més a prop d'un esperó que de l'eix principal: llavors és
     * d'aquella vall lateral i el tall l'hi dibuixa. L'empat se'l queda l'eix principal,
     * que és el cas de Martinet, que **és** la confluència.
     */
    let side = null;
    for (const trib of tributaries) {
      const hit = project([v.lat, v.lng], trib.profile);
      if (hit.offset < main.offset && (!side || hit.offset < side.hit.offset)) {
        side = { trib, hit };
      }
    }

    return {
      name: v.name,
      subregion: v.subregion,
      country: v.country,
      elevation: v.elevation,
      km: main.km,
      /** Distància del poble a l'eix de la vall: diu si és de fons de vall o de vessant. */
      offsetKm: Number((main.offset / 1000).toFixed(2)),
      ...(side
        ? {
            tributary: {
              name: side.trib.name,
              km: side.hit.km,
              offsetKm: Number((side.hit.offset / 1000).toFixed(2)),
            },
          }
        : {}),
    };
  })
  .sort((a, b) => a.km - b.km);

/**
 * Cap poble no pot quedar per damunt de la carena del seu punt. Si hi queda, el passadís
 * s'ha quedat curt i el tall tornaria a dibuixar un punt surant damunt del no res —que és
 * justament el que les carenes venen a arreglar—, però ara amb la muntanya dibuixada a
 * sota, que encara enganya més.
 */
for (const v of placed) {
  const arm = v.tributary
    ? tributaries.find((t) => t.name === v.tributary.name).profile
    : profile;
  const km = v.tributary ? v.tributary.km : v.km;
  const at = arm.find((p) => p.km === km);
  if (at && v.elevation > at.crestEle) {
    throw new Error(
      `${v.name} (${v.elevation} m) passa de la carena del seu punt (${at.crestEle} m al km ${km}) — cal apujar SWATH_M, ara a ${SWATH_M} m`,
    );
  }
}

const points = [profile, ...tributaries.map((t) => t.profile)].flat();
const eleValues = points.map((p) => p.ele);
const meta = {
  stepMetres: STEP_M,
  /** Mig ample del passadís on es mesuren el vessant i la carena. */
  swathMetres: SWATH_M,
  shoulderMetres: SHOULDER_M,
  /** Només la vall principal: la portada en fa la xifra de «km de vall». */
  lengthKm: profile.at(-1).km,
  /**
   * Terreny de l'eix i pobles, **sense** les carenes: són les xifres que surten a la
   * portada i no han de ballar perquè el dibuix hagi guanyat muntanyes al fons.
   */
  minEle: Math.min(...eleValues, ...placed.map((p) => p.elevation)),
  maxEle: Math.max(...eleValues, ...placed.map((p) => p.elevation)),
  /** La carena més alta del passadís: el tall la retalla a dalt, i per això se sap. */
  crestMaxEle: Math.max(...points.map((p) => p.crestEle)),
};

await writeFile(
  OUT,
  `${JSON.stringify(
    {
      _source: {
        axis: 'Polilínia pel fons de vall — coordenades d’OpenStreetMap (ODbL)',
        elevation: 'EU-DEM 25 m via api.opentopodata.org',
        relief:
          'shoulderEle i crestEle: cota màxima del mateix DEM dins de ±1,5 i ±5 km, mesurada perpendicularment a l’eix cada 250 m',
        generatedBy: 'scripts/build-valley-profile.mjs',
      },
      meta,
      profile,
      tributaries,
      villages: placed,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`✓ tall de ${meta.lengthKm} km · ${meta.minEle}–${meta.maxEle} m → src/data/valley-profile.json`);
console.log(`  carenes fins a ${meta.crestMaxEle} m dins de ±${SWATH_M / 1000} km de l'eix`);
for (const trib of tributaries) {
  const poble = placed.filter((p) => p.tributary?.name === trib.name).map((p) => p.name);
  console.log(`  esperó «${trib.name}»: ${trib.lengthKm} km des del km ${trib.joinKm} · ${poble.join(', ')}`);
}
