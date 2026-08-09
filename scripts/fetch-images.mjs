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

import { mkdir, readFile, writeFile, rm, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN = resolve(ROOT, 'data/image-plan.json');
const ASSETS = resolve(ROOT, 'src/assets/restaurants');
const MANIFEST = resolve(ROOT, 'data/image-manifest.json');
/** Magatzem de candidats per al repàs visual. No es publica: viu fora de src/. */
const CANDIDATES = resolve(ROOT, 'data/candidates');
const PICKS = resolve(ROOT, 'data/image-picks.json');

/**
 * Nomes ASCII: les capceleres HTTP no son text lliure i hi ha CDN (jimcdn, per exemple)
 * que responen 403 a un User-Agent amb accents. Sense aixo, Cal Xandera es quedava sense
 * cap fotografia i no hi havia manera de veure per que.
 */
const UA = 'cota-de-tast/0.1 (guia gastronomica de la Cerdanya; contacte: pere@soms.cat)';
const MAX_WIDTH = 2000;

/**
 * Dos llindars i no un.
 *
 * Commons publica originals grans, així que allà exigir 640 px no costa res. El web d'un
 * restaurant, en canvi, sovint serveix la galeria a l'amplada de la columna: Somnia té
 * cinc fotos de 570 px, dues d'elles de plat, i amb el llindar únic queien totes — mentre
 * que les imatges d'IA del mateix web, PNG grans, passaven. La regla de mida seleccionava
 * a favor de les sintètiques. A partir de 520 px les seves entren.
 */
const MIN_WIDTH_OWN = 520;
const MIN_WIDTH_COMMONS = 640;

/** Per sota d'això una foto no pot fer de capçalera: la fitxa la mostra a tota amplada. */
const HERO_WIDTH = 1200;

/** Fotos de Commons per fitxa, com a màxim. Vegeu per què just abans de fer-lo servir. */
const COMMONS_CAP = 4;

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
const PROMO =
  /pop-?up|banner|promo(?:cio|tion)|newsletter|cartell|reserva.?directa|black.?friday|footer|header|background|fondo-|bg-|placeholder|watermark|logo/i;
const JPEG_QUALITY = 82;

const args = process.argv.slice(2);
const only = args.includes('--only')
  ? new Set(args[args.indexOf('--only') + 1].split(','))
  : null;
const force = args.includes('--force');
/** Baixa-ho tot a data/candidates/ i no publiquis res: la tria es fa mirant-les. */
const collect = args.includes('--collect');

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
    if ((info.width ?? 0) < MIN_WIDTH_COMMONS) continue;

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

/* ---- Què retrata cada foto ------------------------------------------------------- */

/*
 * `carta` i `menu` van sortir d'aquesta llista. A Can Ventura nou candidats es diuen
 * `Menu_Can_Ventura_02` o `Cocktails_i_Mocktails`: són les pàgines de la carta, text amb
 * preus, i puntuaven com a plat justament pel nom. Una carta no és una fotografia del
 * restaurant per molt que hi surti un plat a la cantonada.
 */
const FOOD_WORDS =
  /plat(?!a)|plato|dish|food|gastro|cuina|cocina|comida|tapa|postre|entrant|trinxat|arros|arroz|paella|xuleto|txuleton|cargol|caracol|formatge|queso|fondue|raclette|tartar|marisc|peix|pescado|carn(?!aval)|brasa|graella|parrilla|bolet|seta|guiso|pulpo|gofre/i;

/**
 * Documents i material de màrqueting que passen tots els filtres tècnics perquè són
 * imatges de debò: cartes, llistes de preus, xecs regal, logotips sobre fons pla. El
 * repàs visual n'ha trobat d'aquests tipus i cap mesura automàtica els distingia.
 */
const DOCUMENT =
  /menu|carta|cocktail|mocktail|aperitiu|cervesa|combinat|copes|licors|vins?[-_]|dolcos|preus|tarifa|xec|regal|gift|voucher|hivern[-_]?\d|estiu[-_]?\d/i;
const PLACE_WORDS =
  /facana|fachada|exterior|entrada|sala|comedor|menjador|terrassa|terraza|interior|habitacio|habitacion|room|hotel|allotjament|jardi|jardin|barra|celler|bodega|inici|home|slider|cadre/i;
const PEOPLE_WORDS = /equip|equipo|team|nosaltres|nosotros|chef|cuiner|germans|familia|about|presentacio/i;

/**
 * Dues estadístiques sobre una miniatura de 96x96, que és prou per distingir un plat d'un
 * menjador i costa mil·lisegons:
 *
 *   - saturació del terç central contra la de les vores. Un plat és el subjecte i sol anar
 *     sobre estovalles, pissarra o fusta apagades; un menjador té el color repartit.
 *   - nitidesa del centre contra la de les vores. Els plats es fotografien amb poca
 *     profunditat de camp i el fons queda desenfocat; una sala és nítida de punta a punta.
 *
 * Cap de les dues és concloent tota sola; sumades amb el nom del fitxer, encerten prou.
 */
async function photoStats(image) {
  const { data, info } = await image
    .clone()
    .resize(96, 96, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H } = info;
  const at = (i) => i * info.channels;
  const sat = (i) => {
    const r = data[at(i)];
    const g = data[at(i) + 1];
    const b = data[at(i) + 2];
    const mx = Math.max(r, g, b);
    return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
  };
  const lum = (i) => 0.299 * data[at(i)] + 0.587 * data[at(i) + 1] + 0.114 * data[at(i) + 2];
  const middle = (x, y) => x >= W / 3 && x < (2 * W) / 3 && y >= H / 3 && y < (2 * H) / 3;

  let cSat = 0;
  let cSatN = 0;
  let eSat = 0;
  let eSatN = 0;
  let cEdge = 0;
  let cEdgeN = 0;
  let eEdge = 0;
  let eEdgeN = 0;

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      if (middle(x, y)) {
        cSat += sat(i);
        cSatN += 1;
      } else {
        eSat += sat(i);
        eSatN += 1;
      }

      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) continue;
      const laplacian = Math.abs(4 * lum(i) - lum(i - 1) - lum(i + 1) - lum(i - W) - lum(i + W));
      if (middle(x, y)) {
        cEdge += laplacian;
        cEdgeN += 1;
      } else {
        eEdge += laplacian;
        eEdgeN += 1;
      }
    }
  }

  const ratio = (a, b) => (b > 0 ? a / b : 1);
  return {
    satRatio: ratio(cSat / cSatN, eSat / eSatN),
    sharpRatio: ratio(cEdge / cEdgeN, eEdge / eEdgeN),
  };
}

/**
 * Puntuació d'un candidat. Es desa al manifest juntament amb `kind` perquè la tria quedi
 * revisable: «puntuació automàtica» sense deixar-ne rastre vol dir que ningú no pot
 * comprovar-la després, i aquí ja hi ha colat una imatge d'IA i un cartell de reserves.
 */
function classify(url, stats, isOfficial) {
  const name = decodeURIComponent(url.split('/').pop() ?? '');
  let score = isOfficial ? 15 : 0;
  let kind = 'lloc';

  if (FOOD_WORDS.test(name)) {
    score += 60;
    kind = 'plat';
  } else if (PEOPLE_WORDS.test(name)) {
    score -= 20;
    kind = 'gent';
  } else if (PLACE_WORDS.test(name)) {
    score -= 25;
    kind = 'lloc';
  }

  if (stats.satRatio > 1.25) score += 20;
  else if (stats.satRatio > 1.1) score += 10;
  else if (stats.satRatio < 0.85) score -= 10;

  if (stats.sharpRatio > 1.4) score += 20;
  else if (stats.sharpRatio > 1.15) score += 10;
  else if (stats.sharpRatio < 0.8) score -= 10;

  // Sense pista al nom, les dues estadístiques decideixen si es dona per plat.
  if (kind === 'lloc' && !PLACE_WORDS.test(name) && stats.satRatio > 1.15 && stats.sharpRatio > 1.2) {
    kind = 'plat';
  }
  if (!isOfficial) kind = 'paisatge';

  return { kind, score: Math.round(score) };
}

async function saveImage(buffer, dir, file, minWidth) {
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
  const shape = await photoStats(image);

  // Les mides que es desen son les del fitxer resultant, no una barreja de l'amplada
  // retallada amb l'alçada original: amb la barreja, una foto normal semblava una tira.
  const out = await image
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(resolve(dir, file));

  return { file, width: out.width, height: out.height, hash, shape };
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
/** En mode --collect: què s'ha baixat de cada casa, per poder-ho repassar. */
const catalogue = {};

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
    // El pressupost va contra el topall de Commons i no contra `want`: si la casa ja té
    // vuit fotos seves, no cal anar a buscar vint-i-quatre vistes del poble.
    const usable = commonsCandidates.filter((c) => !usedCommons.has(c.sourceUrl)).length;
    if (usable >= COMMONS_CAP * 3) break;
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

  /*
   * Dues passades. Abans es baixava fins a tenir-ne prou i es parava, o sigui que les
   * publicades eren les primeres que el crawler havia trobat: la portada, la façana i el
   * menjador, mentre la galeria —que és on hi ha el menjar— es quedava sense mirar. Ara
   * s'avaluen tots els candidats de la casa i després es tria.
   *
   * En mode `--collect` no es publica res: tot va a `data/candidates/`, es fan fulls de
   * contacte i la tria la fa una persona mirant-los. La puntuació es conserva, però només
   * per ordenar els fulls: va deixar passar un fons de peu de pàgina i va etiquetar de
   * «lloc» dos plats de Somnia, o sigui que serveix per mirar-s'ho abans, no per decidir.
   */
  const outDir = collect ? resolve(CANDIDATES, entry.slug) : dir;
  // La carpeta es buida sempre: amb `want` variable hi poden quedar fitxers d'una
  // execució anterior més llarga i el manifest ja no els referenciaria.
  await rm(outDir, { recursive: true, force: true });

  const pool = [];
  /** Empremtes del que ja ha entrat en aquesta fitxa, per no repetir-hi la mateixa foto. */
  const hashes = [];
  let staged = 0;

  for (const candidate of candidates) {
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

    if (candidate.isOfficial && DOCUMENT.test(candidate.downloadUrl)) {
      report.skipped.push(`${entry.slug}: document, no fotografia → ${candidate.downloadUrl}`);
      continue;
    }

    try {
      const buffer = await get(candidate.downloadUrl, true);
      staged += 1;
      const saved = await saveImage(
        buffer,
        outDir,
        `${String(staged).padStart(3, '0')}.jpg`,
        candidate.isOfficial ? MIN_WIDTH_OWN : MIN_WIDTH_COMMONS,
      );

      // Un retall i l'original de la mateixa foto passen tots dos els filtres de mida:
      // només l'empremta els distingeix, i una galeria no pot repetir-ne cap.
      const twin = hashes.find((h) => hamming(h, saved.hash) <= 8);
      if (twin !== undefined) {
        await rm(resolve(outDir, saved.file), { force: true });
        report.skipped.push(`${entry.slug}: repetida → ${candidate.downloadUrl}`);
        continue;
      }
      hashes.push(saved.hash);

      const { kind, score } = classify(candidate.downloadUrl, saved.shape, candidate.isOfficial);
      pool.push({
        stage: saved.file,
        candidate: `${entry.slug}/${saved.file}`,
        kind,
        score,
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
    } catch (error) {
      report.skipped.push(`${entry.slug}: ${error.message} → ${candidate.downloadUrl}`);
    }

    await sleep(200);
  }

  if (collect) {
    // Ordenats per puntuació només perquè els fulls de contacte comencin pel que té més
    // pinta de menjar. Qui tria és qui mira.
    catalogue[entry.slug] = pool
      .sort((a, b) => b.score - a.score)
      .map(({ stage, ...rest }) => ({ file: stage, ...rest }));
    report.saved += pool.length;
    console.log(`· ${entry.slug.padEnd(28)} ${String(pool.length).padStart(3)} candidats`);
    continue;
  }

  /*
   * Commons no s'infla fins a `want`. Les cases que només tenen Instagram omplirien vuit
   * forats amb vuit vistes del mateix poble; val més una fitxa curta i honesta.
   */
  const own = pool.filter((p) => p.isOfficial).sort((a, b) => b.score - a.score);
  const commons = pool.filter((p) => !p.isOfficial).sort((a, b) => b.score - a.score);
  const chosen = [...own.slice(0, want), ...commons.slice(0, Math.max(0, Math.min(COMMONS_CAP, want - own.length)))];

  /*
   * La primera imatge fa de capçalera de la fitxa, a tota amplada, i de portada de la
   * targeta. Una foto de 570 px estirada a 2.000 es veu tova, així que davant hi va la
   * millor que arribi a HERO_WIDTH; si cap hi arriba, la millor que hi hagi.
   */
  const heroAt = chosen.findIndex((p) => p.width >= HERO_WIDTH);
  if (heroAt > 0) chosen.unshift(...chosen.splice(heroAt, 1));

  const kept = [];
  for (const [i, pick] of chosen.entries()) {
    const file = `${String(i + 1).padStart(2, '0')}.jpg`;
    await rename(resolve(dir, pick.stage), resolve(dir, file));
    const { stage, ...rest } = pick;
    kept.push({ src: `../../assets/restaurants/${entry.slug}/${file}`, ...rest });
    if (!pick.isOfficial) usedCommons.add(pick.sourceUrl);
    report.saved += 1;
  }

  // Les que s'han avaluat i no han entrat no es queden ocupant lloc al disc.
  for (const leftover of pool) {
    if (chosen.includes(leftover)) continue;
    await rm(resolve(dir, leftover.stage), { force: true });
  }

  manifest[entry.slug] = kept;
  if (kept.length === 0) report.thin.push(entry.slug);

  console.log(
    `${kept.length >= want ? '✓' : kept.length > 0 ? '·' : '✗'} ${entry.slug.padEnd(28)} ${kept.length}/${want}`,
  );
}

await mkdir(dirname(MANIFEST), { recursive: true });
if (collect) {
  await mkdir(CANDIDATES, { recursive: true });
  await writeFile(resolve(CANDIDATES, 'index.json'), `${JSON.stringify(catalogue, null, 2)}\n`, 'utf8');
} else {
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

console.log(`\n${report.saved} imatges desades → src/assets/restaurants/`);
if (report.thin.length > 0) console.log(`sense cap imatge: ${report.thin.join(', ')}`);
if (report.skipped.length > 0) {
  console.log(`\ndescartades (${report.skipped.length}):`);
  for (const line of report.skipped.slice(0, 40)) console.log(`  · ${line}`);
}
