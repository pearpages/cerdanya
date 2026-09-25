# Tasques

El que queda obert i el que s'ha fet. Cada canvi actualitza aquest fitxer: marca o afegeix
un element a Open, i una línia datada al capdamunt de **Done**.

## Open

### Indexació a Google

Diagnòstic del 2026-09-25: tècnicament no hi ha res que bloquegi (`robots.txt`, sitemap de
79 URL, 200 a totes, canòniques amb barra, redireccions 301 cap a
`https://cerdanya.soms.cat/`, cap `noindex`, les 79 pàgines enllaçades). El més probable és
un lloc nou (domini des del 2026-08-10, `robots.txt` des del 2026-09-09) i gairebé sense
enllaços d'entrada, amb uns resultats de cerca poc atractius. Per ordre:

- [ ] **Search Console** (a mà): comprovar que la propietat cobreix `cerdanya.soms.cat` (o
      una propietat de domini `soms.cat` verificada per DNS), tornar a enviar
      `sitemap-index.xml`, i fer «Sol·licitar la indexació» amb la inspecció d'URL a la
      portada, `/restaurants/` i unes quantes fitxes. Anotar aquí l'estat de l'informe de
      Pàgines, que és el que decideix el diagnòstic: «Descoberta, no indexada» → enllaços i
      lloc nou; «Rastrejada, no indexada» → qualitat; «Pàgina amb redirecció» o
      «Duplicada» → error tècnic (ha de ser 0).
- [ ] **Arreglar la descripció de les 44 fitxes** (`src/pages/restaurants/[slug].astro:62`):
      hi falta el punt entre el lema i el nom, diu «a la Llívia» i «a la Alta Cerdanya» (ha
      de ser «a l'Alta Cerdanya»).
- [ ] **Títols amb paraules que es cerquen** («restaurant», el poble, «Cerdanya»): ara la
      portada es diu «Cota de tast» i les fitxes «<Nom> · Cota de tast». Per exemple «Can
      Ventura, restaurant a Llívia · Cota de tast» i «Restaurants de la Cerdanya per
      altitud · Cota de tast».
- [ ] **Enllaços d'entrada des de llocs propis**: el blog, masiablanca, un article
      d'anunci, directoris locals i un enllaç des de cada pàgina de `soms.cat`. Ara només
      n'hi ha un, des de la portada de `soms.cat`.
- [ ] Decidir si les 12 fitxes `dataThin` han d'anar a l'índex de Google (opció: `noindex`
      fins que tinguin més a dir, sense treure-les del lloc ni de les llistes).
- [ ] `lastmod` al sitemap (`@astrojs/sitemap` ho pot fer).

### La resta

- [ ] Actualitzar les dependències amb vulnerabilitats (`astro`, `sharp`, `svgo`, `js-yaml`,
      `devalue`; vegeu security.md).
- [ ] El crèdit del peu diu «Made by pearpages» en anglès: cal una prop de text a
      `@pearpages/credit` i pujar-ne una versió, no tocar-ho aquí.
- [ ] Hi ha 19 fitxes marcades com a destacades i la portada no en mostra cap; els rangs de
      `featuredRank` comencen a 2, no a 1.
- [ ] La portada no publica cap `ItemList` dels vuit plats; si es vol, el lloc són les
      targetes de plat.
- [ ] Si es vol comprovació de tipus: instal·lar `@astrojs/check` i `typescript` i afegir-la
      a `npm run check`.
- [ ] Una foto del **tiró amb naps** per als plats de la portada, si mai n'apareix cap (el
      menú de degustació, en canvi, no es pot retratar).

### Seguiment de l'scaffold

- [ ] **Activar el private vulnerability reporting** — security.md hi remet i ara és
      desactivat — Settings → Code security del repo.
- [ ] **Confirmar o rebutjar els ADR 0003–0008** — s'han reconstruït de la història i estan
      com a Proposed — decisions.md.

## Done

- [x] 2026-09-25: Scaffold dels fitxers de coneixement del projecte — 15 creats (8 ADR),
      3 corregits (CLAUDE.md fet shim, README, llicència a package.json), 2 seguiments.
- [x] 2026-09-25: Primera versió publicada per etiqueta (`v1.0.0`).
- [x] 2026-09-25: Etiqueta d'analítica de footfall a `BaseLayout.astro`; comprovada a les
      pàgines en viu.
- [x] 2026-09-25: El desplegament només corre amb etiquetes `v*`; política d'etiqueta `v*`
      a l'entorn `github-pages`.
- [x] 2026-09-09: Crèdit d'autoria del peu des de `@pearpages/credit` (0.2.0), amb les
      variables mapades a tokens per passar AA en fosc.
- [x] 2026-09-09: El repo és a GitHub i Pages desplega des de l'acció; el lloc respon a
      `https://cerdanya.soms.cat/`.
- [x] 2026-09-09: Targeta social a les 79 pàgines (`og:image`), amb `socialCrop()`.
- [x] 2026-09-09: JSON-LD: 44 `Restaurant`, 74 `BreadcrumbList`, 33 `ItemList` i un
      `WebSite`, sense `aggregateRating`.
- [x] 2026-09-09: `public/robots.txt`, `trailingSlash`/`build.format` declarats i
      `scripts/check-build.mjs` al `npm run check` i a CI.
- [x] 2026-08-10: Icones de pestanya generades des de `src/data/brand.json`.
- [x] 2026-08-10: El tema triat sobreviu a la navegació del `ClientRouter`.
- [x] 2026-08-10: Domini `cerdanya.soms.cat` (`public/CNAME`, `site`) i workflow de
      desplegament a GitHub Pages.
- [x] 2026-08-10: La foto del plat «Formatge» era una fondue de xocolata; substituïda per
      una de Commons i corregits els `alt`.
- [x] 2026-08-10: Peu del tall a dues columnes a partir de 60rem.
- [x] 2026-08-10: Secció «On és» a cada fitxa: 44 mapes d'OSM estàtics, `lat`/`lng`,
      enllaç a Google Maps i secció Mapes a `/credits`.
- [x] 2026-08-10: La nota de mètode surt de la portada; secció Textos a `/credits`.
- [x] 2026-08-10: El tall té muntanyes: vessant i carena mesurats, retallats dins el marc.
- [x] 2026-08-09: Dues línies al tall (terreny i pobles), després substituïdes per les
      carenes.
- [x] 2026-08-09: El tall es plega a Martinet: esperó de la vall de Lles.
- [x] 2026-08-09: Tots els punts del tall porten nom, sense encavalcaments.
- [x] 2026-08-09: Vuit targetes de plat a la portada, amb el filtre `?plat=`; fora dinou
      imatges d'IA de Somnia i un cartell promocional d'Arç.
- [x] 2026-08-09: Portada real amb dades reals, `site-images.json`, `og:image`, i l'ordre de
      capes CSS arreglat.
