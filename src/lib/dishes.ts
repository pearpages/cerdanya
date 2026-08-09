import { DISHES, type Dish } from '../data/dishes';
import { elevationOf, type Restaurant } from './restaurants';
import { siteImage, type SiteImage } from './site-images';

/** Sense accents ni majúscules, igual que la cerca del directori. */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Quins dels vuit plats fa aquesta casa. El resultat viatja a la targeta com a
 * `data-dishes`, així que el filtre del directori no torna a fer la comparació de
 * text: compara identificadors ja resolts al build i no pot dir una cosa diferent
 * del recompte de la portada.
 */
export function dishKeysOf(entry: Restaurant): string[] {
  const carta = entry.data.signatureDishes.map(fold);
  return DISHES.filter((dish) =>
    dish.terms.some((term) => carta.some((plat) => plat.includes(fold(term)))),
  ).map((dish) => dish.slug);
}

export interface DishGroup extends Dish {
  restaurants: Restaurant[];
  /** Cotes extremes de les cases que el fan: el plat també té una franja d'altitud. */
  lowest: number;
  highest: number;
  image: SiteImage;
}

export function dishGroups(entries: Restaurant[]): DishGroup[] {
  return DISHES.map((dish) => {
    const restaurants = entries.filter((entry) => dishKeysOf(entry).includes(dish.slug));

    if (restaurants.length === 0) {
      throw new Error(
        `Cap casa de la guia fa «${dish.name}». O els termes de src/data/dishes.ts han quedat desfasats, o el plat ha de sortir de la tria.`,
      );
    }

    const elevations = restaurants.map((entry) => elevationOf(entry.data.town));
    return {
      ...dish,
      restaurants,
      lowest: Math.min(...elevations),
      highest: Math.max(...elevations),
      // Peta si l'id no existeix: una targeta sense foto passaria desapercebuda.
      image: siteImage(dish.photo),
    };
  });
}
