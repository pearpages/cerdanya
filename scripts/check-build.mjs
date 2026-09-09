/**
 * Comprovació d'integritat de dist/ després del build. Corre a CI i atura el desplegament.
 *
 * Què garanteix:
 *   · cada canònica, cada <loc> i cada enllaç intern és la URL on la pàgina se serveix
 *     de debò — no una que hi redirigeix
 *   · cada enllaç intern arriba a una pàgina o un fitxer que existeix
 *   · cada pàgina té un <title> únic, una descripció i una canònica
 *   · cada <img> porta alt i mides
 *   · el sitemap cobreix exactament les pàgines publicades, en els dos sentits
 *
 * Ve de masiablanca (scripts/check-build.mjs), on el problema es va descobrir tard:
 * el comprovador d'allà normalitzava la barra final als dos costats abans de comparar,
 * i per això no va veure mai que les 206 canòniques apuntaven a l'origen d'un 301.
 * Aquí la barra NO es normalitza enlloc: és justament el que es comprova.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const errors = [];
const fail = (msg) => errors.push(msg);

// El config real, no una còpia: així el comprovador no pot discrepar mai de la
// compilació sobre on es publica cada pàgina.
const { default: astroConfig } = await import(
  pathToFileURL(path.join(ROOT, 'astro.config.mjs')).href
);
// Els defectes són els d'Astro, per si algun dia s'omet la clau.
const SITE = (astroConfig.site ?? '').replace(/\/$/, '');
const FORMAT = astroConfig.build?.format ?? 'directory';
const TRAILING = astroConfig.trailingSlash ?? 'ignore';
if (!SITE) fail('astro.config.mjs: falta `site`, i sense ell no hi ha canòniques ni sitemap');

if (FORMAT === 'directory' && TRAILING === 'never') {
  fail(
    "astro.config.mjs: build.format 'directory' amb trailingSlash 'never' — " +
      "cada URL publicada redirigeix. Ha de ser 'ignore' (el defecte) o 'always'.",
  );
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error('dist/ no existeix — executeu npm run build primer');
  process.exit(1);
}

const files = await walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));

/**
 * La URL on un fitxer de dist/ es publica realment — l'única que no redirigeix mai.
 * És la referència de la canònica, del sitemap i de cada href.
 */
const served = (f) => {
  const r = path.relative(DIST, f);
  if (r === 'index.html') return '/';
  if (FORMAT === 'file') return `/${r.replace(/\.html$/, '')}`;
  return `/${r.replace(/index\.html$/, '')}`; // restaurants/arc/index.html → /restaurants/arc/
};

const titles = new Map();
const servedPages = new Set(pages.map(served));
const assets = new Set(files.map((f) => `/${path.relative(DIST, f)}`));

let imgCount = 0;

for (const file of pages) {
  const url = served(file);
  const html = await readFile(file, 'utf8');

  // ---- head -------------------------------------------------------------
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
  if (!title) fail(`${url}: sense <title>`);
  else if (titles.has(title)) fail(`${url}: <title> duplicat amb ${titles.get(title)} — «${title}»`);
  else titles.set(title, url);

  const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1];
  if (!desc || desc.length < 50) fail(`${url}: meta description absent o massa curta`);
  if (desc && desc.length > 320) fail(`${url}: meta description massa llarga (${desc.length})`);

  // La canònica ha de ser EXACTAMENT la URL on es publica la pàgina. Comparar-la
  // normalitzant la barra final és el que a masiablanca va deixar passar que tot
  // el lloc es canonicalitzés cap a un 301.
  const canonical = /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1];
  if (!canonical) fail(`${url}: sense canonical`);
  else if (canonical !== `${SITE}${url}`) {
    fail(`${url}: canonical ${canonical} ≠ la URL publicada (${SITE}${url}) — hi ha un 301 pel mig`);
  }

  const ogUrl = /<meta property="og:url" content="([^"]*)"/.exec(html)?.[1];
  if (ogUrl !== `${SITE}${url}`) fail(`${url}: og:url ${ogUrl} ≠ la URL publicada`);

  if (!/<html lang="ca">/.test(html)) fail(`${url}: <html> sense lang="ca"`);

  const h1 = html.match(/<h1[^>]*>/g) ?? [];
  if (h1.length !== 1) fail(`${url}: ${h1.length} elements h1 (n'hi ha d'haver exactament 1)`);

  // ---- imatges ----------------------------------------------------------
  for (const tag of html.match(/<img[^>]*>/g) ?? []) {
    imgCount++;
    // Astro serialitza alt="" com a atribut buit (`alt` a seques), de manera que
    // s'ha de reconèixer les dues formes o una imatge decorativa correcta es
    // reporta com si li faltés l'atribut.
    const hasAlt = /\salt(=|[\s>])/.test(tag);
    // alt="" és la manera correcta de marcar una imatge decorativa: els lectors
    // de pantalla la salten. El que no pot passar és que l'atribut no hi sigui,
    // que fa que llegeixin el nom del fitxer.
    if (!hasAlt) fail(`${url}: <img> sense atribut alt`);
    if (!/width="/.test(tag) || !/height="/.test(tag)) {
      fail(`${url}: <img> sense width/height (provoca CLS)`);
    }
  }

  // ---- enllaços interns -------------------------------------------------
  // Sense normalitzar la barra: un enllaç a una pàgina que existeix amb una altra
  // forma no està trencat, però faria un 301, i cal dir-ho així o es llegeix
  // malament l'error. El patró talla a ? i a #, de manera que /restaurants/?plat=x
  // es comprova com a /restaurants/.
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const target = m[1];
    if (target.startsWith('/_astro/')) continue;
    if (assets.has(target) || servedPages.has(target)) continue;
    const bare = target.replace(/\/$/, '');
    if (servedPages.has(bare) || servedPages.has(`${bare}/`)) {
      fail(`${url}: ${target} existeix, però la URL publicada és una altra — l'enllaç faria un 301`);
    } else {
      fail(`${url}: enllaç trencat cap a ${target}`);
    }
  }
}

// ---- sitemap ------------------------------------------------------------
const sitemapFile = files.find((f) => /sitemap-\d+\.xml$/.test(f));
if (!sitemapFile) fail('no s’ha generat cap sitemap-N.xml');
else {
  // Coincidència exacta i en els DOS sentits. El sentit invers és el que hauria
  // detectat a la primera que el sitemap llistava URL que redirigeixen.
  const xml = await readFile(sitemapFile, 'utf8');
  const locs = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const indexable = [...servedPages];
  for (const u of indexable) {
    if (!locs.has(`${SITE}${u}`)) fail(`sitemap: hi falta ${SITE}${u}`);
  }
  for (const l of locs) {
    if (!l.startsWith(SITE) || !indexable.includes(l.slice(SITE.length))) {
      fail(`sitemap: ${l} no és cap pàgina publicada`);
    }
  }
}

// ---- robots.txt ---------------------------------------------------------
// El sitemap ja existia i ningú no l'hi apuntava.
const robots = files.find((f) => path.relative(DIST, f) === 'robots.txt');
if (!robots) fail('dist/robots.txt no hi és — cap rastrejador no trobarà el sitemap');
else {
  const txt = await readFile(robots, 'utf8');
  if (!txt.includes(`${SITE}/sitemap-index.xml`)) {
    fail(`robots.txt no apunta a ${SITE}/sitemap-index.xml`);
  }
}

const bytes = (await Promise.all(files.map((f) => stat(f).then((s) => s.size)))).reduce((a, b) => a + b, 0);

console.log(`${pages.length} pàgines · ${imgCount} <img> · ${(bytes / 1048576).toFixed(1)} MB`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} problemes:\n`);
  const cap = process.argv.includes('--all') ? errors.length : 60;
  for (const e of errors.slice(0, cap)) console.error(`  ${e}`);
  if (errors.length > cap) console.error(`  … i ${errors.length - cap} més (--all per veure'ls tots)`);
  process.exit(1);
}
console.log('✓ tot correcte');
