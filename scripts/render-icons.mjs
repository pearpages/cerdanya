/*
 * Les icones del lloc, dibuixades amb el mateix senyal que la capçalera.
 *
 * La geometria surt de src/data/brand.json, que és el que fa servir SiteHeader.astro:
 * si un dia el logotip canvia, es torna a passar aquest script i la pestanya el segueix.
 *
 * El senyal de la capçalera va a l'or de l'accent damunt del paper de la pàgina; una
 * pestanya no té paper nostre —el navegador la pinta clara o fosca segons li convé— i
 * per això la icona porta el seu propi fons de nit. És la capçalera en tema fosc.
 *
 *   node scripts/render-icons.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = JSON.parse(readFileSync(path.join(root, 'src/data/brand.json'), 'utf8'));

/** Fons: --c-nit. Traç: --c-forn-viu, que és l'--accent-ink del tema fosc. */
const NIT = '#061420';
const OR = '#ffb92e';

/** Graella de la icona i gruix del traç dins d'aquesta graella. */
const BOX = 32;
const STROKE = 2.8; // 1,6 escalat es quedaria en mig píxel a 16 px i s'esborraria
const FIT = 0.85; // marge perquè els cims no toquin la vora

/** Caixa del dibuix dins del viewBox de la marca, per centrar-lo a la graella. */
const ART = { x0: 1, x1: 33, y0: 1, y1: 19 };

function markup({ radius, fit = 1 }) {
  const s = (FIT * fit * BOX) / (ART.x1 - ART.x0);
  const tx = BOX / 2 - ((ART.x0 + ART.x1) / 2) * s;
  const ty = BOX / 2 - ((ART.y0 + ART.y1) / 2) * s;
  const stroke = round(STROKE / s);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}" role="img" aria-label="Cota de tast">
  <rect width="${BOX}" height="${BOX}"${radius ? ` rx="${radius}"` : ''} fill="${NIT}" />
  <g transform="translate(${round(tx)} ${round(ty)}) scale(${round(s)})" fill="none" stroke="${OR}" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round">
    <path d="${brand.ridge}" />
    <path d="${brand.base}" opacity="${brand.baseOpacity}" />
  </g>
</svg>
`;
}

const round = (n) => Number(n.toFixed(3));

/** ICO amb PNG a dins: hi caben diverses mides i el navegador tria la que li va bé. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

// Es rasteritza a quatre vegades la mida i s'abaixa: a 16 px, el traç en diagonal és
// tot vora i sense sobremostreig es trenca a escales.
const raster = (svg, size) =>
  sharp(Buffer.from(svg), { density: Math.ceil((96 * size * 4) / BOX) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

const tab = markup({ radius: 7 });
// L'icona d'iOS la retalla el sistema: quadrada, opaca i amb el dibuix una mica endins.
const touch = markup({ radius: 0, fit: 0.88 });

writeFileSync(path.join(root, 'public/favicon.svg'), tab);

const sizes = [16, 32, 48];
const images = [];
for (const size of sizes) images.push({ size, data: await raster(tab, size) });
writeFileSync(path.join(root, 'public/favicon.ico'), ico(images));
writeFileSync(path.join(root, 'public/favicon-96.png'), await raster(tab, 96));
writeFileSync(path.join(root, 'public/apple-touch-icon.png'), await raster(touch, 180));

console.log(
  `Icones fetes: favicon.svg, favicon.ico (${sizes.join('/')}), favicon-96.png, apple-touch-icon.png`
);
