# Cota de tast — guia de restaurants de la Cerdanya

Lloc estàtic (Astro 7, sortida `static`, sense framework de client) amb 44 fitxes de
restaurants dels dos costats de la frontera, publicat a GitHub Pages a
[cerdanya.soms.cat](https://cerdanya.soms.cat). **L'eix del lloc és l'altitud, no la nota ni
l'estrella**: les llistes van de la cota més baixa (Bellver de Cerdanya, 1.048 m) a la més
alta (Font-Romeu, 1.760 m). Tot el text del lloc és en català.

## Documents del projecte — llegeix-los abans de treballar

| Fitxer | Què hi ha |
|---|---|
| [principles.md](principles.md) | Les regles que ha de complir qualsevol canvi |
| [architecture.md](architecture.md) | Com està fet: mòduls, pipeline de dades, el tall de la vall, build i desplegament |
| [decisions.md](decisions.md) | Índex dels ADR de `docs/adr/`: per què es va triar cada cosa |
| [tasks.md](tasks.md) | La feina oberta i el registre datat del que s'ha fet |
| [security.md](security.md) | Superfície, secrets, dependències i com avisar d'una vulnerabilitat |
| [LICENSE](LICENSE) | MIT per al codi; els textos de les fitxes, reservats. Fotos i mapes, amb la llicència de cadascun |

[README.md](README.md) és la porta d'entrada per a qui arriba al repo.

## Regles de treball

1. **Llegeix `principles.md` abans de tocar codi o documents.** Si un canvi en trencaria
   una, atura't i pregunta; no la sorteges.
2. **Cada canvi actualitza `tasks.md`**: marca o afegeix elements a Open, i una línia datada
   al capdamunt de Done.
3. **Un canvi d'estructura o de comportament actualitza `architecture.md` al mateix
   commit**, i el README si es veu des de fora.
4. **Una tria entre alternatives de debò** (dependència, convenció, forma d'una dada,
   procés) és un ADR nou a `docs/adr/` i una línia a `decisions.md`. Es proposa a l'usuari
   abans de marcar-lo Accepted. Un ADR acceptat no s'edita: se'n fa un de nou que el
   substitueix.
5. **El que toqui scripts de xarxa, entrades d'usuari, scripts de client o dependències es
   repassa contra `security.md`**, i l'actualitza si la superfície canvia.
6. **En acabar una sessió, el que s'ha après va a aquests fitxers, no aquí.** Aquest fitxer
   només diu com es treballa i on és cada cosa — mai un diari de sessions.
7. Confirma abans de qualsevol cosa que surti a fora: `push`, etiquetes `v*` (que
   despleguen), crides a les API dels scripts `data:*`.

## Ordres

```bash
npm run dev                 # servidor de desenvolupament
npm run build               # prebuild = lint-credits, després astro build
npm run preview             # serveix dist/ (el que cal per provar el ClientRouter)
npm run check               # build + check-build.mjs (el mateix que corre a CI)
npm run data:villages       # src/data/villages.json (OSM + EU-DEM via OpenTopoData)
npm run data:valley         # src/data/valley-profile.json (el tall de la vall)
npm run data:locations      # geocodifica les 44 adreces → data/location-manifest.json
npm run data:locations:apply # aboca lat/lng i locationNote al frontmatter
npm run data:maps           # cus els tiles d'OSM → src/assets/maps/<slug>.webp
npm run data:icons          # public/favicon.* i apple-touch-icon.png des de brand.json
npm run data:images         # descarrega i publica segons el pla
npm run data:collect        # baixa TOTS els candidats a data/candidates/ per repassar-los
npm run data:publish        # publica la tria de data/image-picks.json
npm run data:restore        # refà src/assets a partir del manifest (recuperació)
npm run data:images:apply   # aboca el manifest al frontmatter de cada fitxa
npm run data:credits        # comprova els crèdits sense construir
```

Els scripts `data:*` no s'executen durant el build; la seva sortida es commiteja. No hi ha
tests unitaris: la xarxa de seguretat és `lint-credits` al `prebuild` i `check-build` al
`npm run check`. Node el fixa `mise.toml`.

**Publicar** és posar una etiqueta: `git tag vX.Y.Z && git push origin vX.Y.Z`. Un `push` a
`main` no desplega res.

## Paranys que ja han mossegat

- **Marges de component que no s'apliquen** → Astro inlinea el full d'un component (que obre
  `@layer components`) abans del que declara el reset → l'ordre de capes es declara amb un
  `<style is:inline>` a `BaseLayout.astro`, abans de tot. No el treguis.
- **Search Console no indexa res («Page with redirect»)** → URL internes, canòniques o
  `<loc>` sense barra final, que GitHub Pages respon amb 301 (va passar a masiablanca) →
  barra final sempre, i **mai normalitzar la barra abans de comparar** al comprovador.
- **El tema es perd en navegar** → el `ClientRouter` copia els atributs de `<html>` del
  document nou i el script del `<head>` no es torna a executar → el tema es reposa a
  `astro:before-swap` sobre `event.newDocument`. En `dev` no es veu: prova-ho amb `preview`.
- **Un plat que surt en fitxes que no el fan** → un terme de cerca curt que viu dins d'una
  altra paraula («orada» dins de «temporada») → cada terme de `dishes.ts` es comprova un per
  un contra les dades.
- **Nominatim no troba una casa que és a OSM** → la cerca lliure vol que quadrin tots els
  trossos i el node no porta número de portal, o cau en un altre municipi → provar nom +
  poble i després el nom sol, i no acceptar cap candidat a més de 3 km del poble.
- **Un camp nou del manifest que no arriba al frontmatter** → s'havia abocat abans de
  regenerar el manifest → primer `data:locations`, després `data:locations:apply`.
- **Una imatge d'`<img>` que ignora l'`aspect-ratio`** → l'atribut `height` guanyava → el
  reset porta `img { height: auto }`.
