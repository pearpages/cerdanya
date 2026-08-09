/**
 * Vocabularis tancats del lloc. Únic punt de veritat: l'esquema de contingut els valida,
 * les pàgines d'índex els recorren i els filtres els pinten. Afegir una categoria nova
 * vol dir afegir-la aquí i enlloc més.
 */

export const CUISINES = [
  'Alta cuina',
  'Cuina de mercat',
  'Catalana tradicional',
  'Muntanya i brasa',
  'Bistrot',
  'Francesa',
  'Peix i marisc',
  'Japonesa',
  'Arrosseria',
  'Tapes',
  'Formatges i làctics',
  'Grill argentí',
  'Slow Food / km 0',
  'Italiana',
] as const;

export const OCCASIONS = [
  'Sopar especial',
  'Dinar en família',
  'Après-ski',
  'Terrassa d’estiu',
  'De pas',
] as const;

export const SUBREGIONS = ['Baixa Cerdanya', 'Alta Cerdanya', 'Llívia'] as const;

export const PRICE_RANGES = ['€', '€€', '€€€', '€€€€'] as const;

export const SERVICES = [
  'celiacs',
  'vegetariana',
  'adaptat',
  'terrassa',
  'parquing',
  'grups',
] as const;

export const SERVICE_LABELS: Record<(typeof SERVICES)[number], string> = {
  celiacs: 'Apte per a celíacs',
  vegetariana: 'Opcions vegetarianes',
  adaptat: 'Adaptat a mobilitat reduïda',
  terrassa: 'Terrassa',
  parquing: 'Pàrquing',
  grups: 'Grups',
};

export const PRICE_LABELS: Record<(typeof PRICE_RANGES)[number], string> = {
  '€': 'Fins a 25 €',
  '€€': '25–45 €',
  '€€€': '45–70 €',
  '€€€€': 'Més de 70 €',
};

export type Cuisine = (typeof CUISINES)[number];
export type Occasion = (typeof OCCASIONS)[number];
export type Subregion = (typeof SUBREGIONS)[number];
export type PriceRange = (typeof PRICE_RANGES)[number];
export type Service = (typeof SERVICES)[number];

/** Converteix un nom lliure (categoria, poble) en un segment d'URL estable. */
export function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
