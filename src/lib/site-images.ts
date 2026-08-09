import type { ImageMetadata } from 'astro';
import siteImagesData from '../data/site-images.json';

/**
 * Les fotos que no pengen de cap fitxa (portada, seccions generals). Les de restaurant
 * les valida l'esquema de la col·lecció; aquestes no tenen col·lecció que les validi, així
 * que el contracte es manté aquí: si el fitxer no hi és o l'id no existeix, peta el build
 * en comptes de publicar una imatge sense crèdit.
 */
/*
 * Només les carpetes que comencen per guió baix: `_site` (portada i seccions) i `_dishes`
 * (els vuit plats). Les de restaurant queden fora a posta — són 176 i les carrega la
 * col·lecció quan toca, no cal tenir-les totes resoltes aquí.
 */
const files = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/restaurants/_*/*.{jpg,jpeg,png,webp}',
  { eager: true },
);

export interface SiteImage {
  id: string;
  /** On es fa servir, per poder-ho dir a la pàgina de crèdits. */
  usedOn: string;
  src: ImageMetadata;
  alt: string;
  author: string;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
  isOfficial: boolean;
}

export const siteImages: SiteImage[] = siteImagesData.images.map((image) => {
  const file = files[`../assets/restaurants/${image.file}`];
  if (!file) {
    throw new Error(
      `La imatge de lloc «${image.file}» no és a src/assets/restaurants/. Torna a executar npm run data:images.`,
    );
  }
  const { file: _path, ...credit } = image;
  return { ...credit, src: file.default };
});

const byId = new Map(siteImages.map((image) => [image.id, image]));

export function siteImage(id: string): SiteImage {
  const image = byId.get(id);
  if (!image) {
    throw new Error(`No hi ha cap imatge de lloc amb id «${id}» a src/data/site-images.json.`);
  }
  return image;
}
