# Cota de tast — guia de restaurants de la Cerdanya

Lloc estàtic (Astro 7, sortida `static`, sense framework de client) amb 44 fitxes de
restaurants dels dos costats de la frontera. Tot el text del lloc és en català.

## Idea que ho ordena tot

**L'eix del lloc és l'altitud, no la nota ni l'estrella.** Les llistes van de la cota més
baixa (Bellver de Cerdanya, 1.048 m) a la més alta (Font-Romeu, 1.760 m), i la frontera
hi surt on és de debò perquè explica què es menja a cada banda. Si afegeixes una fitxa
d'un poble nou, l'has d'afegir també a `scripts/build-villages.mjs` i regenerar les
dades: `elevationOf()` peta el build abans que publicar un restaurant a la cota zero.

## Ordres

```bash
npm run dev                 # servidor de desenvolupament
npm run build               # prebuild = lint-credits, després astro build
npm run preview             # serveix dist/
npm run data:villages       # src/data/villages.json (OSM + EU-DEM via OpenTopoData)
npm run data:valley         # src/data/valley-profile.json (el tall de la vall)
npm run data:images         # descarrega imatges → src/assets + data/image-manifest.json
npm run data:images:apply   # aboca el manifest al frontmatter de cada fitxa
npm run data:credits        # comprova els crèdits sense construir
```

Els scripts `data:*` no s'executen durant el build; la seva sortida es commiteja.

## Regles no negociables

- **Cap imatge sense crèdit.** `author`, `license` i `sourceUrl` són obligatoris a
  l'esquema de la col·lecció i `scripts/lint-credits.mjs` els torna a comprovar al
  `prebuild`: si en falta un, el build s'atura. Les fotos que no pengen de cap fitxa
  (portada, seccions) viuen a `src/data/site-images.json` i passen el mateix filtre.
  Totes surten, una per una, a `/credits`.
- **Els textos són originals** i citen les fonts al peu de cada fitxa. Quan d'una casa
  no en circula res de comprovable es marca `dataThin: true` i es diu a la UI (12 de 44).
- **Res d'estils en línia.** Cada component o pàgina té el seu `.css` al costat, amb
  noms de classe de bloc-element. Els colors i les mides surten sempre de `tokens.css`.

## Arquitectura

```
src/
  content/restaurants/*.md   Font de veritat de cada fitxa (frontmatter + prosa)
  content.config.ts          Esquema Zod; valida taxonomies i crèdits d'imatge
  data/taxonomy.ts           Vocabularis tancats (cuines, ocasions, serveis, preus)
  data/villages.json         Coordenades i altitud de cada poble  ← build-villages.mjs
  data/valley-profile.json   Perfil real del fons de vall         ← build-valley-profile.mjs
  data/site-images.json      Crèdits de les fotos que no són de cap fitxa
  lib/restaurants.ts         Ordenació per cota, agrupacions, veïns
  lib/site-images.ts         Resol site-images.json → ImageMetadata (peta si falta el fitxer)
  components/                ValleySection (el tall), RestaurantCard, FilterBar, PhotoCredit…
  styles/                    tokens.css i base.css són globals; la resta, per pàgina
```

### Capes de CSS

L'ordre és `reset, tokens, base, components, utilities` i **es declara a `BaseLayout.astro`
amb un `<style is:inline>`, abans de tot**. No el treguis: Astro pot inlinear el full d'un
component (que obre `@layer components`) per damunt del bundle que porta `base.css`, i
llavors «components» queda registrat primer, el reset es declara després i li trepitja tots
els marges. És un error silenciós i costa de veure.

`.section-title`, `.eyebrow`, `.page` i `.prose` són compartides i viuen a `base.css`
perquè les fan servir pàgines que carreguen fulls diferents. Si una pàgina fa servir una
classe de `directory.css`, ha d'importar `directory.css`.

## Sessió del 9 d'agost de 2026

Fet:

- **Portada real** (`src/pages/index.astro` + `src/styles/home.css`), que era l'únic que
  quedava per acabar: era un esborrany amb comptatges inventats i estils en línia. Ara
  llegeix les dades reals — hero a tota pantalla, xifres del conjunt, el tall de la vall,
  set fitxes destacades, les categories i una banda fosca de mètode que enganxa amb el peu
  (`flushFooter`, que fins ara no feia servir ningú).
- `src/data/site-images.json` + `src/lib/site-images.ts` per a les fotos de portada, amb el
  mateix contracte de crèdits; `lint-credits.mjs` les comprova i surten a `/credits`.
- `og:image` a la portada i a les fitxes (retall 1200×630 JPEG amb `getImage`).
- **Bug de l'ordre de capes** descrit més amunt: cap marge de component s'aplicava. En
  arreglar-lo, la capçalera de fitxa va passar a encavalcar-se amb la foto tal com estava
  pensada; s'ha reescrit (fitxa i portada) apilant text i imatge amb grid en comptes d'un
  marge negatiu, que es trencava quan el títol ocupava més línies.
- `img { height: auto }` al reset: l'atribut `height` del fitxer guanyava i les galeries i
  les miniatures de crèdits es dibuixaven a l'alçada original, ignorant l'`aspect-ratio`.
- Desbordament horitzontal del tall dins de contenidors grid (`minmax(0, 1fr)` a
  `.home-section` i `.fitxa__main`, `min-inline-size: 0` a `.valley`). Comprovat: cap
  desbordament a 360/390/500/820/1100/1440 px en 10 pàgines.
- `/credits` no importava `directory.css` i li faltava mitja fulla d'estils.
- Xifres que no quadraven amb les dades: el peu deia 1.061/1.750 m i el directori parlava
  de Martinet (que no té cap fitxa). Ara surten de `villages.json`.
- `package.json`: `data:directory` apuntava a un script que no existeix; substituït pels
  quatre scripts reals.

Pendent:

- **`site` a `astro.config.mjs` encara és `https://cerdanya.example`.** Cal posar-hi el
  domini de debò abans de publicar: d'aquí surten les canòniques, el sitemap i les URL
  absolutes de les `og:image`.
- `npm run check` demana instal·lar `@astrojs/check` i `typescript` (no hi són).
- El repositori no està sota git.
- Hi ha 19 fitxes marcades com a destacades i la portada només en mostra 7; els rangs de
  `featuredRank` comencen a 2, no a 1.
