# Seguretat

La superfície de seguretat de Cota de tast i les regles que la protegeixen. Les regles
generals són a [principles.md](principles.md); com encaixen les peces, a
[architecture.md](architecture.md). Aquest fitxer s'actualitza quan la superfície canvia
(una entrada nova, un script de client, un servei extern, una dependència, un permís).

## Com avisar d'una vulnerabilitat

Mai amb un issue públic mentre no estigui arreglada. El canal previst és l'avís privat de
GitHub (*Security → Report a vulnerability*) al repo `pearpages/cerdanya`.
TODO: activar el *private vulnerability reporting* del repo (ara és desactivat).

## Superfície

**El lloc publicat** és HTML estàtic a GitHub Pages: sense servidor propi, sense
formularis que enviïn res, sense comptes ni autenticació, sense galetes.

- **JS de client**, tot nostre i en línia o empaquetat per Astro:
  - el filtre del directori, que llegeix `?plat=` de la URL. El valor només es compara amb
    identificadors coneguts de `data-dishes`, i el nom que s'ensenya surt de `DISHES`
    (via `textContent`), mai del paràmetre;
  - el tema, a `localStorage['cerdanya-theme']`, amb la lectura dins d'un `try`;
  - el `ClientRouter` d'Astro.
- **Tercers carregats per la pàgina:** només el script d'analítica de footfall
  (`analytics.pearpages.com`, Umami autoallotjat, sense galetes). Tipus de lletra, mapes i
  fotos se serveixen des del mateix domini.
- **Enllaços de sortida** a osm.org, Google Maps, webs dels restaurants i fonts.

**Els scripts `data:*`** corren a mà, en local, i són l'única part que llegeix contingut
que no controlem:

- Descarreguen HTML i imatges de les webs dels restaurants i de Wikimedia Commons
  (`fetch-images.mjs`), i consulten Nominatim, els tiles d'OSM i OpenTopoData.
- Les imatges passen per `sharp` (libvips). Un fitxer maliciós és un risc per a la màquina
  que corre l'script, no per al lloc: el que es publica és una tria revisada a ull.
- Respecten les polítiques d'ús de cada API (1 petició per segon a OSM, `User-Agent` amb
  contacte).

**CI** (`.github/workflows/deploy.yml`): permisos `contents: read`, `pages: write` i
`id-token: write`; corre només amb etiquetes `v*`, sense secrets i sense cap petició a fora
durant el build.

## Secrets

- No n'hi ha cap: ni el build ni els scripts `data:*` fan servir claus ni variables
  d'entorn.
- Si mai n'entra un, va a variables d'entorn o a secrets de GitHub Actions, mai al repo;
  `.env*` ha d'anar al `.gitignore` i un `.env.example` només en diu els noms.

## Dependències

- Poques dependències d'execució (Astro, `@astrojs/sitemap`, `sharp`, les fonts de
  `@fontsource-variable`, `@pearpages/credit`) i `yaml` en desenvolupament. El
  `package-lock.json` es commiteja i CI instal·la amb `npm ci`.
- Les accions de GitHub van fixades per etiqueta de versió principal (`@v4`, `@v3`), no per
  SHA.
- Auditoria a mà amb `npm audit`; no hi ha Dependabot ni Renovate.

## Riscos coneguts

- `npm audit` (2026-09-25) dona 5 vulnerabilitats a dependències de producció: `astro`
  ≤ 7.2.7 (crítica), `sharp` < 0.35.4, `svgo` 4.0.0–4.0.2 i `js-yaml` 4.0.0–4.3.1 (altes), i
  `devalue` < 5.9.1 (moderada). Com que el lloc és estàtic, afecten sobretot el build i els
  scripts locals, no el que es publica; queden pendents d'actualitzar a tasks.md.
- Les accions de CI fixades per etiqueta i no per SHA: acceptat mentre siguin accions
  oficials d'`actions/`.
