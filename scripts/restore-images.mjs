#!/usr/bin/env node
/**
 * Torna a deixar `src/assets/restaurants/` tal com diu `data/image-manifest.json`.
 *
 * Existeix perquè el projecte no està sota git i `fetch-images.mjs` buida la carpeta d'una
 * fitxa abans de tornar-la a omplir: si l'execució s'atura pel mig, el disc i el manifest
 * deixen de dir el mateix i no hi ha manera de tornar enrere. Una vegada això va deixar la
 * portada amb una foto que no era la que el crèdit deia — que en una guia que promet saber
 * d'on ve cada imatge és el pitjor que pot passar.
 *
 * El manifest guarda `originUrl` de cada fitxer, o sigui que la reconstrucció és exacta i
 * no torna a triar res: baixa la mateixa URL i la desa al mateix lloc. Comprova les mides
 * contra les que hi ha desades i avisa si no quadren.
 *
 * Ús:
 *   node scripts/restore-images.mjs            només el que falta o no quadra
 *   node scripts/restore-images.mjs --all      tot, encara que sembli correcte
 *   node scripts/restore-images.mjs --only x,y  només aquestes fitxes
 */

import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = resolve(ROOT, 'src/assets/restaurants');
const MANIFEST = resolve(ROOT, 'data/image-manifest.json');

const MAX_WIDTH = 2000;
const JPEG_QUALITY = 82;
const UA = 'cerdanya-guide/0.1 (guia gastronomica de la Cerdanya)';

const args = process.argv.slice(2);
const all = args.includes('--all');
const onlyArg = args.find((a) => a.startsWith('--only'));
const only = onlyArg
  ? new Set((onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1] ?? '').split(','))
  : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(attempt * 2000);
    }
  }
  throw new Error('inabastable');
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const report = { ok: 0, restored: 0, mismatched: [], failed: [], orphans: [] };

for (const [slug, images] of Object.entries(manifest)) {
  if (only && !only.has(slug)) continue;

  const dir = resolve(ASSETS, slug);
  await mkdir(dir, { recursive: true });

  for (const [index, image] of images.entries()) {
    const file = `${String(index + 1).padStart(2, '0')}.jpg`;
    const path = resolve(dir, file);

    if (!all) {
      try {
        await stat(path);
        const meta = await sharp(path).metadata();
        if (meta.width === image.width && meta.height === image.height) {
          report.ok += 1;
          continue;
        }
        report.mismatched.push(`${slug}/${file}: ${meta.width}x${meta.height} != ${image.width}x${image.height}`);
      } catch {
        /* no hi és: es baixa */
      }
    }

    try {
      const buffer = await download(image.originUrl);
      const out = await sharp(buffer)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toFile(path);

      if (out.width !== image.width || out.height !== image.height) {
        report.mismatched.push(
          `${slug}/${file}: baixada ${out.width}x${out.height}, manifest ${image.width}x${image.height}`,
        );
      }
      report.restored += 1;
      await sleep(250);
    } catch (error) {
      report.failed.push(`${slug}/${file}: ${error.message} → ${image.originUrl}`);
    }
  }

  // Fitxers que el manifest no reconeix: sobres d'una execució interrompuda.
  const expected = new Set(images.map((_, i) => `${String(i + 1).padStart(2, '0')}.jpg`));
  for (const found of await readdir(dir)) {
    if (expected.has(found)) continue;
    report.orphans.push(`${slug}/${found}`);
    await rm(resolve(dir, found), { force: true });
  }
}

console.log(`✓ ${report.ok} correctes · ${report.restored} restaurades`);
if (report.orphans.length > 0) {
  console.log(`\nfitxers orfes esborrats (${report.orphans.length}):`);
  for (const line of report.orphans) console.log(`  · ${line}`);
}
if (report.mismatched.length > 0) {
  console.log(`\nmides que no quadren (${report.mismatched.length}):`);
  for (const line of report.mismatched) console.log(`  · ${line}`);
}
if (report.failed.length > 0) {
  console.error(`\n✗ no s'han pogut restaurar (${report.failed.length}):`);
  for (const line of report.failed) console.error(`  · ${line}`);
  process.exit(1);
}
