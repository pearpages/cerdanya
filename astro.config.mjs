// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cerdanya.soms.cat',
  output: 'static',
  // GitHub Pages té semàntica de directori: amb format 'directory' cada pàgina és
  // <ruta>/index.html i se serveix a <ruta>/, responent 301 a <ruta> sense barra.
  // Amb 'never' tot el lloc s'enllaçaria a l'origen d'aquell redirect i el sitemap
  // seria una llista de redireccions —que és el que va passar a masiablanca, on
  // Search Console va classificar-ho tot com a «Page with redirect» i no ho va
  // indexar. Totes dues claus són el defecte d'Astro; es declaren perquè
  // scripts/check-build.mjs les llegeixi i perquè el combinat prohibit quedi escrit.
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  image: {
    // Totes les imatges són locals (descarregades pel pipeline), cap remota al build.
    responsiveStyles: true,
  },
});
