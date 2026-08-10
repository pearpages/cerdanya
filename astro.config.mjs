// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cerdanya.soms.cat',
  output: 'static',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
  image: {
    // Totes les imatges són locals (descarregades pel pipeline), cap remota al build.
    responsiveStyles: true,
  },
});
