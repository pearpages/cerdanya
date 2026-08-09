#!/usr/bin/env node
/**
 * Publica les imatges triades a mà.
 *
 * Llegeix `data/image-picks.json` —la tria feta mirant els candidats un per un— i
 * `data/candidates/index.json`, i n'escriu el resultat a `src/assets/restaurants/` i a
 * `data/image-manifest.json`. Les cases que no surten als picks no es toquen: conserven
 * el que ja tenien publicat.
 *
 * La separació és a posta. `fetch-images.mjs --collect` baixa i filtra el que pot filtrar
 * una màquina (mida, proporció, contrast, duplicats, noms d'IA i de reclam); aquí només
 * es copia el que una persona ha dit que sí. El motiu és que les coses que s'havien colat
 * —cartes amb preus, pictogrames de wifi, logotips de guies, plaques de subvenció,
 * collages, i fotos d'un local a 200 km— són fotografies o gràfics perfectament vàlids:
 * cap mesura les distingeix d'una foto de sala. Només es veuen mirant-les.
 *
 * Ús: node scripts/publish-images.mjs [--only slug1,slug2]
 */

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = resolve(ROOT, 'src/assets/restaurants');
const CANDIDATES = resolve(ROOT, 'data/candidates');
const MANIFEST = resolve(ROOT, 'data/image-manifest.json');
const PICKS = resolve(ROOT, 'data/image-picks.json');

const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;

const picks = JSON.parse(await readFile(PICKS, 'utf8'));
const catalogue = JSON.parse(await readFile(CANDIDATES + '/index.json', 'utf8'));
const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

const problems = [];
let published = 0;
let touched = 0;

for (const [slug, entry] of Object.entries(picks)) {
  if (slug.startsWith('_')) continue;
  if (only && !only.has(slug)) continue;

  const chosen = entry.picks ?? [];
  const pool = catalogue[slug] ?? [];
  const byFile = new Map(pool.map((item) => [item.file.replace('.jpg', ''), item]));

  const resolved = [];
  for (const id of chosen) {
    const item = byFile.get(id);
    if (!item) {
      problems.push(`${slug}: el candidat «${id}» no és a data/candidates/${slug}/`);
      continue;
    }
    resolved.push(item);
  }
  if (resolved.length === 0) {
    problems.push(`${slug}: cap candidat vàlid, no es toca`);
    continue;
  }

  /*
   * Les de Commons de la selecció anterior es conserven al final: als pobles on la casa
   * té poca fotografia pròpia són el que evita una fitxa amb dues imatges. No es tornen a
   * triar perquè no hi ha res a triar — són vistes del poble.
   */
  const keptCommons = (manifest[slug] ?? []).filter((image) => !image.isOfficial);
  const total = [...resolved, ...keptCommons].slice(0, 8);

  const dir = resolve(ASSETS, slug);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const images = [];
  for (const [index, item] of total.entries()) {
    const file = `${String(index + 1).padStart(2, '0')}.jpg`;
    const from = item.file
      ? resolve(CANDIDATES, slug, item.file)
      : resolve(ROOT, 'data/candidates', slug, item.file ?? '');

    if (item.file && byFile.has(item.file.replace('.jpg', ''))) {
      await copyFile(from, resolve(dir, file));
    } else {
      // Ve del manifest anterior (Commons): es torna a baixar amb restore-images.
      problems.push(`${slug}/${file}: de Commons, cal executar restore-images.mjs`);
    }

    const { file: _stage, stage: _s, candidate: _c, score: _sc, ...rest } = item;
    images.push({ src: `../../assets/restaurants/${slug}/${file}`, ...rest });
    published += 1;
  }

  manifest[slug] = images;
  touched += 1;
  console.log(`✓ ${slug.padEnd(28)} ${String(images.length).padStart(2)} imatges`);
}

await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`\n${published} imatges a ${touched} fitxes`);
if (problems.length > 0) {
  console.log(`\navisos (${problems.length}):`);
  for (const line of problems) console.log(`  · ${line}`);
  console.log('\nExecuta `node scripts/restore-images.mjs` per completar les de Commons.');
}
