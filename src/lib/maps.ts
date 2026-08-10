import type { ImageMetadata } from 'astro';
import mapSource from '../data/map-source.json';
import type { Restaurant } from './restaurants';

/**
 * El mapa de cada fitxa. La imatge la dibuixa `scripts/render-maps.mjs` cosint tiles
 * d'OpenStreetMap i es commiteja: quan algú llegeix una fitxa no es demana res a cap
 * servidor extern, igual que amb les fotografies.
 */
const files = import.meta.glob<{ default: ImageMetadata }>('../assets/maps/*.webp', {
  eager: true,
});

export const MAP_SOURCE = mapSource;

/** La imatge del mapa d'una casa, si ja s'ha dibuixat. */
export function mapImage(slug: string): ImageMetadata | undefined {
  return files[`../assets/maps/${slug}.webp`]?.default;
}

/** Totes les cases que tenen mapa, per a la pàgina de crèdits. */
export function mappedSlugs(): string[] {
  return Object.keys(files)
    .map((path) => path.replace('../assets/maps/', '').replace('.webp', ''))
    .sort();
}

/**
 * El punt exacte a openstreetmap.org, que és d'on surt el dibuix. El zoom és el mateix
 * amb què està dibuixat el mapa de la fitxa, perquè qui hi clica hi trobi el mateix.
 */
export function osmUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

/**
 * L'enllaç a Google Maps va per nom i adreça, i no per coordenades: per coordenades
 * s'hi obre una xinxeta buida al mig del no-res, i per nom s'hi obre la fitxa del
 * negoci, amb els horaris i el telèfon, que és el que va a buscar qui hi clica.
 */
export function googleMapsUrl(entry: Restaurant): string {
  const query = encodeURIComponent(`${entry.data.name}, ${entry.data.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
