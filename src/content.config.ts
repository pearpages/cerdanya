import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  CUISINES,
  OCCASIONS,
  PRICE_RANGES,
  SERVICES,
  SUBREGIONS,
} from './data/taxonomy';

/**
 * Crèdit d'una imatge. `author`, `license` i `sourceUrl` són obligatoris a propòsit:
 * cap imatge pot entrar al lloc sense saber de qui és i sota quines condicions.
 * `scripts/lint-credits.mjs` fa la mateixa comprovació abans del build.
 */
const imageCredit = (image: () => z.ZodTypeAny) =>
  z.object({
    src: image(),
    alt: z.string().min(1),
    author: z.string().min(1),
    authorUrl: z.string().url().optional(),
    license: z.string().min(1),
    licenseUrl: z.string().url().optional(),
    sourceUrl: z.string().url(),
    /** true quan la imatge ve del web o del compte oficial del restaurant. */
    isOfficial: z.boolean().default(false),
  });

const restaurants = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/restaurants' }),
  schema: ({ image }) =>
    z.object({
      name: z.string().min(1),
      /** Noms alternatius o comercials: alimenten la cerca del directori. */
      altNames: z.array(z.string()).default([]),
      tagline: z.string().min(1),

      town: z.string().min(1),
      subregion: z.enum(SUBREGIONS),
      country: z.enum(['ES', 'FR']),
      address: z.string().min(1),
      lat: z.number().optional(),
      lng: z.number().optional(),

      phone: z.string().optional(),
      email: z.string().email().optional(),
      website: z.string().url().optional(),
      instagram: z.string().url().optional(),

      cuisine: z.array(z.enum(CUISINES)).min(1),
      occasion: z.array(z.enum(OCCASIONS)).default([]),

      priceRange: z.enum(PRICE_RANGES),
      priceFrom: z.number().optional(),
      priceTo: z.number().optional(),

      rating: z.number().min(0).max(5).optional(),
      reviewCount: z.number().int().nonnegative().optional(),
      ratingSource: z.string().optional(),

      services: z.array(z.enum(SERVICES)).default([]),
      signatureDishes: z.array(z.string()).default([]),

      featured: z.boolean().default(false),
      featuredRank: z.number().int().positive().optional(),

      hours: z.string().optional(),
      closedDays: z.string().optional(),

      images: z.array(imageCredit(image)).default([]),

      /** URLs consultats per redactar el text. Es mostren al peu de la fitxa. */
      sources: z
        .array(z.object({ label: z.string().min(1), url: z.string().url() }))
        .default([]),

      /** Marca les fitxes amb informació pública escassa, per ser honestos a la UI. */
      dataThin: z.boolean().default(false),
    }),
});

export const collections = { restaurants };
