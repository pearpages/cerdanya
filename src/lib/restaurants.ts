import { getCollection, type CollectionEntry } from 'astro:content';
import villagesData from '../data/villages.json';
import { toSlug, type Cuisine } from '../data/taxonomy';

export type Restaurant = CollectionEntry<'restaurants'>;

interface Village {
  name: string;
  subregion: string;
  country: string;
  lat: number;
  lng: number;
  elevation: number;
}

const villages = villagesData.villages as Village[];
const byName = new Map(villages.map((v) => [v.name, v]));

/**
 * Altitud del poble. És el que ordena tota la guia, així que si un restaurant apunta a
 * un poble que no és al dataset val més petar al build que publicar-lo a la cota zero.
 */
export function elevationOf(town: string): number {
  const village = byName.get(town);
  if (!village) {
    throw new Error(
      `El poble «${town}» no és a src/data/villages.json. Afegeix-lo a scripts/build-villages.mjs i torna a generar les dades.`,
    );
  }
  return village.elevation;
}

export function villageOf(town: string): Village {
  const village = byName.get(town);
  if (!village) throw new Error(`Poble desconegut: ${town}`);
  return village;
}

/** Totes les fitxes, de la cota més baixa a la més alta. Aquest és l'ordre del lloc. */
export async function allRestaurants(): Promise<Restaurant[]> {
  const entries = await getCollection('restaurants');
  return entries.sort((a, b) => {
    const byElevation = elevationOf(a.data.town) - elevationOf(b.data.town);
    if (byElevation !== 0) return byElevation;
    return a.data.name.localeCompare(b.data.name, 'ca');
  });
}

/** Els destacats, per l'ordre editorial que porten al frontmatter. */
export function featured(entries: Restaurant[]): Restaurant[] {
  return entries
    .filter((entry) => entry.data.featured)
    .sort((a, b) => (a.data.featuredRank ?? 99) - (b.data.featuredRank ?? 99));
}

export interface VillageGroup {
  name: string;
  slug: string;
  elevation: number;
  subregion: string;
  country: string;
  restaurants: Restaurant[];
}

export function groupByVillage(entries: Restaurant[]): VillageGroup[] {
  const groups = new Map<string, Restaurant[]>();
  for (const entry of entries) {
    const list = groups.get(entry.data.town) ?? [];
    list.push(entry);
    groups.set(entry.data.town, list);
  }

  return [...groups.entries()]
    .map(([name, restaurants]) => {
      const village = villageOf(name);
      return {
        name,
        slug: toSlug(name),
        elevation: village.elevation,
        subregion: village.subregion,
        country: village.country,
        restaurants,
      };
    })
    .sort((a, b) => a.elevation - b.elevation);
}

export interface CuisineGroup {
  name: Cuisine;
  slug: string;
  restaurants: Restaurant[];
}

export function groupByCuisine(entries: Restaurant[]): CuisineGroup[] {
  const groups = new Map<string, Restaurant[]>();
  for (const entry of entries) {
    for (const cuisine of entry.data.cuisine) {
      const list = groups.get(cuisine) ?? [];
      list.push(entry);
      groups.set(cuisine, list);
    }
  }

  return [...groups.entries()]
    .map(([name, restaurants]) => ({
      name: name as Cuisine,
      slug: toSlug(name),
      restaurants,
    }))
    .sort((a, b) => b.restaurants.length - a.restaurants.length);
}

/** Veïns per proximitat de cota: qui menja a 1.700 m no baixa a 1.000 m per sopar. */
export function nearby(entry: Restaurant, entries: Restaurant[], limit = 3): Restaurant[] {
  const home = elevationOf(entry.data.town);
  return entries
    .filter((other) => other.id !== entry.id)
    .map((other) => ({
      other,
      distance: Math.abs(elevationOf(other.data.town) - home),
      sameTown: other.data.town === entry.data.town,
    }))
    .sort((a, b) => {
      if (a.sameTown !== b.sameTown) return a.sameTown ? -1 : 1;
      return a.distance - b.distance;
    })
    .slice(0, limit)
    .map((match) => match.other);
}

/** Nombre de restaurants per poble, per dibuixar el tall. */
export function valleyVillages(entries: Restaurant[]) {
  return groupByVillage(entries).map((group) => ({
    name: group.name,
    elevation: group.elevation,
    count: group.restaurants.length,
    subregion: group.subregion,
  }));
}

export function formatElevation(metres: number): string {
  return metres.toLocaleString('ca-ES');
}
