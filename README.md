# Cota de tast

Guia de restaurants de la **Cerdanya**, dels dos costats de la frontera — 44 cases a 17
pobles, de Bellver de Cerdanya (1.048 m) al replà de Font-Romeu (1.760 m).

L'eix del lloc és **l'altitud, no la nota ni l'estrella**: les llistes van de la cota més
baixa a la més alta, i la frontera hi surt on és de debò perquè explica què es menja a
cada banda. Cada fitxa seu al seu lloc d'un tall real de la vall, dibuixat amb terreny
mesurat i no amb una línia decorativa.

→ **[cerdanya.soms.cat](https://cerdanya.soms.cat)**

## Posar-hi mà

Cal [mise](https://mise.jdx.dev/). No fa falta cap instal·lació global de node.

```bash
mise install
npm install
npm run dev
```

| Ordre | Què fa |
|---|---|
| `npm run dev` | Servidor de desenvolupament |
| `npm run build` | Compila a `dist/` (el `prebuild` atura el build si falta un crèdit) |
| `npm run preview` | Serveix `dist/` |
| `npm run check` | Compila i verifica canòniques, enllaços, sitemap, `alt` i `robots.txt` |
| `npm run data:*` | Refà les dades: pobles, tall de la vall, mapes, imatges, icones (manual) |

Els scripts `data:*` **no s'executen durant el build**: la seva sortida es commiteja. La
llista sencera i les instruccions de treball detallades són a [`CLAUDE.md`](CLAUDE.md).

## Dues coses que peten a posta

El build s'atura, en comptes de publicar, quan alguna cosa deixaria de ser certa:

- **`scripts/lint-credits.mjs`** (al `prebuild`) — cap imatge no es publica sense `author`,
  `license` i `sourceUrl`.
- **`scripts/check-build.mjs`** (al `npm run check` i a CI, abans de pujar l'artefacte) —
  cada canònica, cada enllaç intern i cada `<loc>` del sitemap han de ser la URL on la
  pàgina se serveix de debò, i no una que hi redirigeixi.

## Continguts i llicències

Els textos són originals i citen les fonts al peu de cada fitxa; quan d'una casa no en
circula res de comprovable, es diu a la fitxa mateixa (12 de 44). Les fotografies són o bé
cortesia de cada restaurant o bé de Wikimedia Commons, i totes surten una per una —amb
autor, llicència i enllaç a l'original— a
[/credits](https://cerdanya.soms.cat/credits). **Cap imatge no és generada amb IA.**

Els mapes són tiles d'[OpenStreetMap](https://www.openstreetmap.org/copyright) cosits en
una imatge per fitxa: © col·laboradors d'OpenStreetMap, ODbL 1.0 per a les dades i
CC BY-SA 2.0 per al dibuix. Les altituds surten d'EU-DEM via
[OpenTopoData](https://www.opentopodata.org/).

És una guia independent, sense cap vinculació amb els restaurants ressenyats ni amb cap
administració.
