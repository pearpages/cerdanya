/**
 * Els vuit plats que expliquen la vall.
 *
 * No és un vocabulari tancat com CUISINES: és una tria editorial de què es cuina a la
 * Cerdanya, sis del receptari de casa i dos de les cartes que juguen a una altra cosa.
 * Cap plat és de ningú en concret — la portada els fa servir precisament per no haver de
 * destacar cap restaurant.
 *
 * `terms` són fragments que es busquen dins dels `signatureDishes` de cada fitxa, sense
 * accents i en minúscules. El filtre del directori compara contra la mateixa llista de
 * plats resolta al build, així que el recompte de la portada i el resultat de
 * /restaurants no poden divergir. Si un plat es queda sense cap casa, el build peta
 * (vegeu `dishGroups()` a src/lib/dishes.ts).
 *
 * Els termes s'han triat un per un contra les dades: cada coincidència és un plat real
 * de la carta, no una paraula que passava per allà. Compte amb els fragments curts —
 * «orada» viu dins de «temporada», per exemple.
 *
 * `photo` apunta a `src/data/site-images.json`. Sis de les vuit fotos són d'una casa de
 * la guia i es van triar mirant-les una per una; les altres dues són de Commons perquè a
 * la vall no n'hi ha cap de publicada. Es guarden copiades a `_dishes/` i no enllaçades a
 * la galeria d'origen: si un dia es torna a baixar les imatges d'aquell restaurant, la
 * numeració balla i la portada acabaria ensenyant una altra cosa sense avisar.
 *
 * Dos plats que hi haurien de ser i no hi són: el **tiró amb naps**, que és el plat de
 * festa d'aquesta vall i del qual no hi ha cap fotografia ni a les cases ni a Commons, i
 * el **menú de degustació**, que només fan dues cases i que no es pot retratar. Tots dos
 * segueixen sortint a les fitxes; el que no tenen és targeta.
 */

export type DishKind = 'tradicional' | 'alta-cuina';

export interface Dish {
  slug: string;
  name: string;
  kind: DishKind;
  /** Què és, en una línia. */
  blurb: string;
  terms: string[];
  /** Id d'una imatge de src/data/site-images.json. */
  photo: string;
}

export const DISHES: Dish[] = [
  {
    slug: 'trinxat',
    name: 'Trinxat de la Cerdanya',
    kind: 'tradicional',
    blurb:
      'Col d’hivern i patata aixafades, amb cansalada o rosta. És el plat que més es repeteix a la guia i no n’hi ha dos d’iguals: hi ha qui hi posa col kale i qui en fa una bomba.',
    terms: ['trinxat'],
    photo: 'plat-trinxat',
  },
  {
    slug: 'arrossos',
    name: 'Arrossos',
    kind: 'tradicional',
    blurb:
      'De muntanya amb bolets, a la llauna, de jarret de xai. I, quan la carta mira al mar, de llamàntol o de sípia.',
    terms: ['arros', 'arrossos', 'paella'],
    photo: 'plat-arrossos',
  },
  {
    slug: 'caca-i-bolets',
    name: 'Caça i bolets',
    kind: 'tradicional',
    blurb:
      'Cabirol, cérvol, ceps i múrgoles. És la part de la carta que canvia amb el calendari i que no es pot demanar tot l’any.',
    terms: ['caca', 'cabirol', 'cervol', 'bolet', 'ceps'],
    photo: 'plat-caca-i-bolets',
  },
  {
    slug: 'cuina-d-olla',
    name: 'Cuina d’olla',
    kind: 'tradicional',
    blurb:
      'Escudella, peus de porc, farcellets de col, ollada. El que es cou a foc lent perquè a 1.200 m l’hivern és llarg.',
    terms: ['escudella', 'peus de porc', 'peu de porc', 'farcellets', 'ollada', 'carn d’olla'],
    photo: 'plat-cuina-d-olla',
  },
  {
    slug: 'carn-a-la-brasa',
    name: 'Carn a la brasa',
    kind: 'tradicional',
    blurb:
      'Xuletó madurat, filet de vaca, carn a la pedra. La llar de foc és mig comedor a les cases de muntanya d’aquesta vall.',
    terms: ['brasa', 'xuleto', 'txuleton', 'entrecot', 'graellada', 'carn a la pedra', 'josper'],
    photo: 'plat-carn-a-la-brasa',
  },
  {
    slug: 'formatge',
    name: 'Formatge',
    kind: 'tradicional',
    blurb:
      'Fondue, raclette i taules de formatges de productors d’aquí: el Molí de Ger, Meranges, Mas Garraet.',
    terms: [
      'fondue',
      'raclette',
      'taula de formatges',
      'blau del moli',
      'formatge blau',
      'formatge d’ovella',
    ],
    photo: 'plat-formatge',
  },
  {
    slug: 'tartar-i-cru',
    name: 'Tàrtar i cru',
    kind: 'alta-cuina',
    blurb:
      'Tàrtar tallat a ganivet, carpaccio, tataki, sashimi. La part de la carta que no passa pel foc, i que aquí arriba fins als 1.760 m.',
    terms: ['tartar', 'carpaccio', 'tataki', 'sashimi', 'nigiri', 'gravlax'],
    photo: 'plat-tartar-i-cru',
  },
  {
    slug: 'peix-i-marisc',
    name: 'Peix i marisc',
    kind: 'alta-cuina',
    blurb:
      'Pop, gambes, vieires, bacallà i orada. Que la vall no toqui el mar no vol dir que no s’hi mengi peix.',
    terms: [
      'pop ',
      'gamba',
      'vieira',
      'bacalla',
      'llamantol',
      'orada sencera',
      'calamar',
      'cranc',
      'salmo',
      'sipia',
      'anxova',
      'truita de riu',
      'rap',
    ],
    photo: 'plat-peix-i-marisc',
  },
];

export const DISH_KIND_LABELS: Record<DishKind, string> = {
  tradicional: 'De la vall',
  'alta-cuina': 'Alta cuina',
};
