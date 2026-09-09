/**
 * Dades estructurades (JSON-LD) per als cercadors.
 *
 * Dues regles, i totes dues per la mateixa raó que sosté `/credits`:
 *
 * 1. **Cap camp inventat.** Si el frontmatter no el porta, no surt. Un horari o un
 *    telèfon a mitges és pitjor que cap: el cercador el publica com a nostre.
 * 2. **Cap `aggregateRating`.** 29 de les 44 fitxes porten `rating`, i la fitxa el
 *    mostra —però sempre dient de qui és: Google, Tripadvisor, Restaurant Guru o la
 *    Guia Repsol. Publicar-lo com a `aggregateRating` d'aquesta casa seria dir que la
 *    nota és nostra quan és d'una altra plataforma, cosa que les directrius de Google
 *    prohibeixen expressament i que es paga amb una acció manual. La nota es queda a
 *    la pàgina, atribuïda, que és on és honesta.
 */
import type { CollectionEntry } from 'astro:content';
import { toSlug } from '../data/taxonomy';

/** Treu les claus buides perquè el JSON-LD no publiqui camps a mitges. */
const compact = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)),
  ) as T;

const abs = (site: URL | undefined, path: string) => new URL(path, site).href;

/**
 * Una casa de la guia. `image` i `geo` només hi són si la fitxa els té: les
 * coordenades venen de `npm run data:locations` i una fitxa nova n'entra sense.
 */
export function restaurantSchema(
  entry: CollectionEntry<'restaurants'>,
  { site, url, image }: { site: URL | undefined; url: string; image?: string },
) {
  const { data } = entry;
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: data.name,
    description: data.tagline,
    url: abs(site, url),
    image: image ? abs(site, image) : undefined,
    servesCuisine: data.cuisine,
    priceRange: data.priceRange,
    telephone: data.phone,
    email: data.email,
    sameAs: [data.website, data.instagram].filter(Boolean),
    address: compact({
      '@type': 'PostalAddress',
      streetAddress: data.address,
      addressLocality: data.town,
      addressCountry: data.country,
    }),
    geo:
      data.lat != null && data.lng != null
        ? { '@type': 'GeoCoordinates', latitude: data.lat, longitude: data.lng }
        : undefined,
    // `hours` no s'hi publica: schema.org vol un format màquina («Tu,We 13:00-15:30»)
    // i el que tenim és prosa en català («Dimarts, dimecres… i dissabte 13:00–15:30»).
    // Passar-la-hi seria publicar un camp mal format, que és la regla 1 al revés. Els
    // horaris es queden a la pàgina, que és on es llegeixen bé.
  });
}

/** La molla de pa que la pàgina ja dibuixa, declarada perquè el cercador la llegeixi. */
export function breadcrumbSchema(
  crumbs: { name: string; path: string }[],
  site: URL | undefined,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(site, c.path),
    })),
  };
}

/** Una llista de cases: el directori, un poble o una cuina. */
export function itemListSchema(
  items: { name: string; path: string }[],
  site: URL | undefined,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: abs(site, item.path),
    })),
  };
}

/** La ruta d'una fitxa, en un sol lloc perquè no divergeixi de RestaurantCard. */
export const restaurantPath = (id: string) => `/restaurants/${id}/`;
export const villagePath = (town: string) => `/pobles/${toSlug(town)}/`;
export const cuisinePath = (cuisine: string) => `/cuina/${toSlug(cuisine)}/`;

/**
 * El lloc mateix, només a la portada. És el que permet als cercadors ensenyar
 * «Cota de tast» com a nom del lloc en comptes del domini. Sense `SearchAction`:
 * la cerca del directori és un filtre de client sobre 44 fitxes, no una URL de
 * cerca que un cercador pugui cridar, i declarar-la seria prometre el que no hi ha.
 */
export function websiteSchema(site: URL | undefined) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Cota de tast',
    alternateName: 'Cota de tast — guia de restaurants de la Cerdanya',
    url: abs(site, '/'),
    inLanguage: 'ca',
  };
}
