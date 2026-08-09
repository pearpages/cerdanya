# Cota de tast — guia de restaurants de la Cerdanya

Lloc estàtic (Astro 7, sortida `static`, sense framework de client) amb 44 fitxes de
restaurants dels dos costats de la frontera. Tot el text del lloc és en català.

## Idea que ho ordena tot

**L'eix del lloc és l'altitud, no la nota ni l'estrella.** Les llistes van de la cota més
baixa (Bellver de Cerdanya, 1.048 m) a la més alta (Font-Romeu, 1.760 m), i la frontera
hi surt on és de debò perquè explica què es menja a cada banda. Si afegeixes una fitxa
d'un poble nou, l'has d'afegir també a `scripts/build-villages.mjs` i regenerar les
dades: `elevationOf()` peta el build abans que publicar un restaurant a la cota zero.

El tall té **dos eixos**, no un. El principal va de Martinet a Font-Romeu; l'esperó de la
vall de Lles hi desemboca al quilòmetre zero i el dibuix s'hi plega, de manera que
Travesseres i Lles de Cerdanya seuen al terreny de la seva vall i no surant damunt del
Segre. Si un poble nou és d'una vall lateral enfilada, mira't `TRIBUTARIES` a
`scripts/build-valley-profile.mjs`: la polilínia s'ordena **des de la confluència cap
enfora** i el script peta si el terreny hi baixa més de 20 m en pujar, que vol dir que la
recta ha creuat una carena i el que mostreja no és aquella vall.

El relleu del tall no és només l'eix: a cada mostra s'hi mesura també el terreny **de
costat**, i d'aquí surten el vessant (la cota màxima a 1,5 km) i la carena (a 5 km). És el
que fa que un poble de vessant seu en algun lloc en comptes de surar. El mateix script
peta si la cota d'un poble passa de la carena del seu punt: vol dir que `SWATH_M` s'ha
quedat curt i que el dibuix tornaria a ensenyar un punt penjat, ara damunt d'una muntanya
dibuixada, que enganya més que el blanc.

## Ordres

```bash
npm run dev                 # servidor de desenvolupament
npm run build               # prebuild = lint-credits, després astro build
npm run preview             # serveix dist/
npm run data:villages       # src/data/villages.json (OSM + EU-DEM via OpenTopoData)
npm run data:valley         # src/data/valley-profile.json (el tall de la vall)
npm run data:images         # descarrega i publica segons el pla
npm run data:collect        # baixa TOTS els candidats a data/candidates/ per repassar-los
npm run data:publish        # publica la tria de data/image-picks.json
npm run data:restore        # refà src/assets a partir del manifest (recuperació)
npm run data:images:apply   # aboca el manifest al frontmatter de cada fitxa
npm run data:credits        # comprova els crèdits sense construir
```

Els scripts `data:*` no s'executen durant el build; la seva sortida es commiteja.

## Regles no negociables

- **Cap imatge sense crèdit.** `author`, `license` i `sourceUrl` són obligatoris a
  l'esquema de la col·lecció i `scripts/lint-credits.mjs` els torna a comprovar al
  `prebuild`: si en falta un, el build s'atura. Les fotos que no pengen de cap fitxa
  (portada, seccions, plats) viuen a `src/data/site-images.json` i passen el mateix
  filtre. Totes surten, una per una, a `/credits`.
- **La tria d'imatges es fa mirant-les.** `npm run data:images -- --collect` baixa tots
  els candidats a `data/candidates/` i els filtra pel que una màquina pot filtrar; la tria
  es fa a `data/image-picks.json`, a ull, i `npm run data:publish` la publica. No hi ha
  drecera: el que s'hi havia colat —cartes amb preus, pictogrames de wifi, logotips de
  guies, plaques de subvenció, xecs regal, collages i fotos d'un local a 200 km— són
  imatges perfectament vàlides que cap mesura de mida, proporció o contrast distingeix
  d'una foto de sala.
- **Cap imatge generada amb IA.** La fitxa acredita cada foto com a «Cortesia del
  restaurant», o sigui que afirma que és una fotografia d'aquella casa; un plat que no ha
  existit mai trenca la promesa que sosté tot el lloc. `SYNTHETIC` a
  `scripts/fetch-images.mjs` les rebutja pel nom del fitxer i `PROMO` fa el mateix amb els
  cartells de reserva. El filtre no atrapa una imatge rebatejada: **mireu-vos les fotos
  noves**, que les marques d'aigua dels generadors solen ser a baix a la dreta.
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
  data/valley-profile.json   Perfil real del terreny + esperons   ← build-valley-profile.mjs
  data/dishes.ts             Els vuit plats de la portada: termes de cerca i foto
  data/site-images.json      Crèdits de les fotos que no són de cap fitxa
  lib/restaurants.ts         Ordenació per cota, agrupacions, veïns
  lib/dishes.ts              Resol plat → cases que el fan, franja de cota i foto
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

## Els vuit plats de la portada

La portada **no destaca cap restaurant**. La secció central són vuit plats — sis del
receptari de casa i dos de les cartes d'alta cuina — i cada targeta obre
`/restaurants/?plat=<slug>` amb totes les cases que el fan.

El recompte de la targeta i el del directori no poden divergir perquè surten del mateix
lloc: `dishKeysOf()` resol els plats al build i els deixa a `data-dishes` de cada targeta;
el filtre del client compara identificadors, no text. Si un dia no quadren, el bug és allà
i no a la portada.

Els `terms` de cada plat es comproven **un per un contra les dades** abans d'afegir-los:
cada coincidència ha de ser un plat real d'alguna carta. Compte amb els fragments curts —
«orada» viu dins de «temporada» i va colar dues fitxes sense peix a la targeta de peix.

Les fotos són a `src/assets/restaurants/_dishes/`, **copiades** i no enllaçades a la
galeria d'origen: si es tornen a baixar les imatges d'un restaurant la numeració balla i
la portada ensenyaria una altra cosa sense avisar. Sis surten d'una casa de la guia i dues
de Commons, perquè a la vall no n'hi ha cap de publicada.

Falten dos plats que hi haurien de ser: el **tiró amb naps**, que és el plat de festa
d'aquesta vall i del qual no hi ha cap fotografia enlloc, i el **menú de degustació**, que
només fan dues cases i no es pot retratar. Si algun dia apareix una foto del tiró, entra.

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

Segona tanda, el mateix dia:

- **Vuit targetes de plat** substitueixen els restaurants destacats de la portada, amb el
  filtre `?plat=` al directori i una píndola que diu per què surten 11 cases i no 44.
- **Dinou imatges generades amb IA** al web de Somnia (nou de Gemini, deu de ChatGPT), dues
  de les quals ja estaven publicades a la seva fitxa acreditades com a fotografies seves.
  Fora, i filtre nou al pipeline. Racó de Riu en tenia tres més al pla, sense publicar.
- Un cartell de «Reserveu directe» d'Arç que passava per fotografia: filtre `PROMO`.
- **Foto del plat «Tàrtar i cru»** canviada: la de Dresden era carn picada crua amb flash i
  no feia gens de gana. Ara hi ha *Classic steak tartare* (insatiablemunch, CC BY 2.0, de
  Commons), emmotllat i amb el rovell vessant-se. Cap casa de la guia en té cap de
  publicada, així que segueix sent de Commons.

Tercera tanda, el mateix dia — **el tall porta tots els noms**:

- Tots els punts de `ValleySection` porten el nom (17 pobles), no només els que tenien més
  d'un restaurant. Un punt sense nom obligava a passar-hi el ratolí, i al mòbil no n'hi ha.
  Quatre fileres de noms en comptes de tres, amb topall superior perquè cap nom no surti
  per damunt de la caixa. La versió `compact` segueix escrivint només el poble de la
  fitxa: no hi caben. (Els noms d'aleshores, `ROW_OFFSETS` i `LABEL_MIN_Y`, ja no
  existeixen: avui són `ROWS`/`ROW_STEP` i `LABEL_TOP_LIMIT`/`LABEL_BOTTOM_LIMIT`.)
- El repartiment de noms ara també **esquiva els punts dels altres pobles**, no només els
  altres noms: la capa de noms es pinta al damunt i la vora de paper que els fa llegibles
  se'ls empassava (es menjava el punt de Bor i el de Das).
- **Travesseres i Lles de Cerdanya**, que sortien apilats a la mateixa columna i enganxats
  a l'escala de cotes. Primer intent: `GUTTER` (el perfil arrenca endins de la caixa) i un
  ventall (`FAN_KM`) que separa els pobles que comparteixen punt de confluència. Els
  separava, però seguien surant amb tiges de 137 px. **Substituït per l'esperó**, més
  avall; el ventall es queda al codi però ara mateix no l'activa cap parell.
- Comprovat al navegador: 17 punts, 17 noms, cap encavalcament nom-nom ni nom-punt, res
  fora del `viewBox`, i bé en clar i en fosc.

Quarta tanda, el mateix dia — **el tall es plega a Martinet**:

- La tija de Lles feia 137 px i es llegia com un error del gràfic. Moure el punt «a un
  lloc més alt de la línia» no era possible sense mentir: el perfil no arriba als 1.470 m
  fins al km 36,25, al costat de Font-Romeu. El que s'ha fet és **allargar el tall vall de
  Lles amunt**, i ara és una secció longitudinal contínua: arrenca a Lles (1.470 m), baixa
  fins a Martinet (980 m) i des d'allà remunta la Cerdanya fins a Font-Romeu.
- `TRIBUTARIES` a `build-valley-profile.mjs` i clau nova `tributaries` al JSON, amb els
  pobles que hi cauen més a prop que no pas de l'eix principal (`tributary`). L'empat se'l
  queda l'eix principal, que és el cas de Martinet: **és** la confluència. `meta.lengthKm`
  segueix sent 39,75 perquè la portada en fa una xifra.
- `densify()` no emet el vèrtex final; a l'eix principal no es nota, però a l'esperó la
  línia s'aturaria abans d'arribar a Lles. S'hi afegeix el vèrtex terminal.
- Al component, coordenada de recorregut `s` (`sMain`/`sHead`) en lloc de km, i `viewBox`
  de 1000 a 1089 perquè l'esperó no encongís la vall principal. `min-inline-size` puja de
  34 a 37rem en la mateixa proporció.
- **Cada braç es suavitza pel seu compte.** Suavitzant a través del plec, la mitjana de
  tres mostres barreja l'esperó al km 0,25 (1.043 m) amb el Segre al km 0,25 (990 m) i
  dibuixaria el fons de Martinet a 1.004 m: un pic de 24 m que no existeix. Comprovat al
  DOM que el plec es dibuixa a 985 m.
- `groundAt()` llegeix la línia suavitzada i no les mostres en cru, que és el que es veu.
- Comprovació al navegador: tija de Lles de **137 px a 1,4**; la de Travesseres, 0. 17
  punts, 17 noms, cap encavalcament, res fora del `viewBox`, clar i fosc, i cap
  desbordament horitzontal a 500 px.

Cinquena tanda — **dues línies al tall**:

- Els punts no seguien la línia i no ho feien de manera consistent: vuit suraven (Urús
  200 m per damunt del fons de vall, 56 px) i **quatre quedaven per sota** — Queixans,
  amb el punt més petit i 7,8 px submergit, no es veia. No era cap error de dibuix:
  l'alçada d'un punt és la cota real del poble i la línia era el terreny a l'eix de la
  vall, i per a un poble a 4 km de l'eix són dos números diferents.
- Ara n'hi ha **dues**: la del terreny i la dels pobles. Els punts seuen a la segona per
  construcció, sense moure cap cota, i **la separació entre línies passa a ser llegible**
  — que és el que la tija mirava d'explicar. La línia dels pobles va amb la tinta dels
  noms (`--ink-2`) i el terreny recula (opacitat 0,42): línia i noms són la mateixa capa.
- **Només en són dades els vèrtexs.** Entre poble i poble no s'hi ha mesurat res, i per
  això aquells trams no se suavitzen: una corba faria com si hi hagués relleu. El peu ho
  diu amb totes les lletres.
- La tija cap al terreny passa a ser un **enllaç del punt al seu nom**, i els noms poden
  anar amunt o avall. `groundAt()` i `groundY` fora.
- **La banda no es tria per proximitat en píxels.** Un nom a sobre necessita menys marge
  que un a sota (a dalt hi cap amb el descens de la lletra, a baix hi ha de caber tota
  l'alçada) i aquells cinc píxels i escaig decantaven catorze noms de disset cap amunt
  sense cap més motiu que la tipografia. Es tria pel relleu, com a qualsevol mapa: qui
  sobresurt dels veïns porta el nom a dalt i qui hi fa fondalada, a baix. Resultat: 9 i 8,
  tots a la primera filera.
- El primer desplaçament depèn del **radi del punt**: amb un radi fix, Llívia (9
  restaurants, radi 7,5) tenia 2,5 px de marge i Bor 5,9, cosa que no es veia fins que hi
  ha una ratlla dibuixada al mig.
- Regla nova: **l'enllaç no pot travessar el punt d'un altre poble**. Riu de Cerdanya i
  Urús queden a 5,8 px l'un de l'altre —dues valls que projecten al mateix quilòmetre— i
  cadascun cau dins del passadís de l'altre.
- `CHAR_W` es quedava un 20% curt als noms curts («Das», «Bor», «Alp», «Ger»), que són
  justament els del tram atapeït. Ara les lletres estretes compten a part.
- Sortida d'emergència `DX_OPTIONS`: si un nom no cap ni a dalt ni a baix, s'aparta de
  costat i l'enllaç va en diagonal. En fa falta una: «Riu de Cerdanya» fa 82 px en un
  veïnat de 75. Amb això, cap nom es queda sense lloc.
- Comprovat sense navegador (`viewBox`, repartidor i col·lisions reproduïts amb les
  constants llegides del component): 17 punts, 17 noms, tots a la filera 0, cap
  encavalcament nom-nom, nom-punt, enllaç-punt ni enllaç-nom, res fora del `viewBox`.
  **Falta la comprovació visual** — feta a la sisena tanda.

## Sessió del 10 d'agost de 2026 — **el tall té muntanyes**

La línia dels pobles confonia: dues línies del mateix gruix que volien dir coses
diferents, i la segona es llegia com si fos relleu. Fora. El que la feia falta —que els
punts seguin en algun lloc— ara ho fa el terreny mateix.

- **Passadís de carenes** a `build-valley-profile.mjs`. A cada mostra de l'eix s'hi mesura
  el terreny perpendicularment, cada 250 m fins a 5 km a banda i banda (`swathOf()`,
  `heading()`), i se'n guarden dos màxims: `shoulderEle` (≤1,5 km) i `crestEle` (≤5 km).
  Són 7.175 punts en comptes de 175, una tanda d'un minut i escaig contra la mateixa API.
  El JSON amb prou feines creix: dos enters per mostra.
- **±5 km no és un número rodó**: dels disset pobles dibuixats el més lluny de l'eix és
  Alp, a 4,92 km. Amb el passadís més estret la seva cota passaria per damunt de la carena
  i tornaria a surar. El script ho comprova i peta amb el nom del poble.
- **Tres capes** al component, totes mesurades i totes al mateix punt del recorregut:
  carena, vessant i fons de vall. `chain(field)` substitueix el `headArm`/`mainArm`
  triplicat — cada braç se suavitza pel seu compte també per al vessant i la carena, que
  al plec de Martinet també canvien de vall.
- **Les carenes surten del marc i s'hi retallen** (`clipPath` `valley-plot`): pugen fins a
  2.225 m i la caixa acaba a 1.850. Apujar `ELE_MAX` fins a encabir-les aixafaria la
  franja 1.048–1.760, que és on viuen tots els pobles i el que el tall ha de deixar
  llegir. El degradat de la carena arrenca a opacitat 0 a dalt: és el que amaga el tall
  recte del retall i el fa passar per boira.
- **La profunditat, només amb opacitat sobre `--sky`** (0,07 / 0,11 / 0,26–0,17). Cap
  color nou —l'or és l'únic accent i el gasten la frontera i el poble de la fitxa— i cap
  hex fix, que `--sky` canvia de sentit entre temes. Com que cada capa conté la del
  davant, les opacitats se sumen i surten tres graons nets. `.valley__ridge` puja de 0,42
  a 0,7: ja no competeix amb res i és l'única vora del relleu.
- El degradat del fons va en `userSpaceOnUse` i no per caixa de camí: per caixa, cada capa
  s'esvairia a la seva pròpia alçada i les tres es llegirien a la mateixa distància.
- Comprovat al navegador (portada, `/pobles/`, fitxa de poble i de restaurant): 17 punts i
  17 noms, **cap encavalcament nom-nom ni nom-punt i res fora del `viewBox`** —el
  repartidor no s'ha tocat i només mira punts—, capes ben niuades (carena a y −38, o sigui
  retallada de debò; vessant 58,6; fons 73,7), clar i fosc, variant compacta, i el dibuix
  segueix desplaçant-se dins de la seva caixa a 360 i 390 px sense arrossegar la pàgina.
- Dels disset punts, quinze seuen entre el fons de vall i el vessant; Das i Angostrina
  sobresurten del vessant però queden ben bé sota la carena. Els quatre que queden **per
  sota** del fons de vall (Queixans −28 m, Llívia −24 m, Travesseres −9 m, Bolvir −5 m)
  segueixen on eren: seuen més avall que l'eix amb què els mesurem, i el peu ho diu.

Pendent:

- **`site` a `astro.config.mjs` encara és `https://cerdanya.example`.** Cal posar-hi el
  domini de debò abans de publicar: d'aquí surten les canòniques, el sitemap i les URL
  absolutes de les `og:image`.
- `npm run check` demana instal·lar `@astrojs/check` i `typescript` (no hi són).
- Hi ha 19 fitxes marcades com a destacades i la portada només en mostra 7; els rangs de
  `featuredRank` comencen a 2, no a 1.
