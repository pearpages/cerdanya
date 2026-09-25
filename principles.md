# Principis

Qualsevol canvi en aquest repositori —codi, textos, dades o procés— compleix aquestes
regles. Quan un canvi en trencaria una, atura't i pregunta en comptes de sortejar-la.
Canviar un principi és una decisió: vol l'acord de l'usuari i un ADR
([decisions.md](decisions.md)). Com està fet el lloc és a [architecture.md](architecture.md);
les regles de seguretat, a [security.md](security.md).

Cada regla porta un **Per què**, i un **Comprovació** quan alguna cosa la fa complir.

## El lloc

**P1. L'eix és l'altitud, no la nota ni l'estrella.** Les llistes van de la cota més baixa a
la més alta, i la frontera hi surt on és de debò. Un poble nou s'afegeix a
`scripts/build-villages.mjs` i es regeneren les dades.
*Per què:* és el que explica què es menja a cada banda de la vall, i el que distingeix la
guia d'un rànquing. *Comprovació:* `elevationOf()` peta el build abans que publicar una
fitxa a la cota zero.

**P2. La portada no destaca cap restaurant.** La secció central són els plats, i cada
targeta obre el directori filtrat amb totes les cases que el fan.
*Per què:* destacar-ne unes quantes seria posar una nota que la guia no posa. El recompte
de la targeta i el del directori surten del mateix `dishKeysOf()` i no poden divergir.
*Comprovació:* revisió.

**P3. Tot el text del lloc és en català.**
*Per què:* és una guia escrita per a qui la llegeix en català, dels dos costats de la
frontera. *Comprovació:* revisió. (El rètol del crèdit del peu és l'excepció coneguda i
viu a tasks.md.)

## Veritat del que es publica

**P4. Cap imatge sense crèdit.** `author`, `license` i `sourceUrl` a cada foto, i les que no
pengen de cap fitxa passen pel mateix filtre des de `src/data/site-images.json`. Totes
surten una per una a `/credits`.
*Per què:* publicar una foto és dir de qui és. *Comprovació:* l'esquema de
`content.config.ts` i `scripts/lint-credits.mjs` al `prebuild` aturen el build.

**P5. La tria d'imatges es fa mirant-les.** `data:collect` baixa i filtra el que una màquina
pot filtrar; la tria es fa a ull a `data/image-picks.json` i `data:publish` la publica.
*Per què:* cartes amb preus, pictogrames, logotips de guies, plaques de subvenció, xecs
regal, collages i fotos d'un local a 200 km passaven tots els filtres de mida i contrast.
*Comprovació:* revisió visual; no hi ha drecera.

**P6. Cap imatge generada amb IA.**
*Per què:* la fitxa acredita cada foto com a «Cortesia del restaurant»; un plat que no ha
existit mai trenca la promesa que sosté tot el lloc (n'hi havia dinou al web de Somnia).
*Comprovació:* `SYNTHETIC` i `PROMO` a `scripts/fetch-images.mjs` pel nom del fitxer. Una
imatge rebatejada s'escapa: mireu-vos les fotos noves, sobretot la cantonada de baix a la
dreta.

**P7. El que diem d'una foto ha de ser cert, no només la foto.** Un `alt` descriu el que
s'hi veu de debò.
*Per què:* la fondue «de formatge» de la portada era de xocolata; la foto era real i el
que en dèiem, fals. *Comprovació:* revisió.

**P8. El mapa no dibuixa una precisió que no tenim.** El punt surt d'un node d'OSM (`poi`),
d'una adreça postal (`address`) o del centre del poble (`village`). El tercer porta
`locationNote` i la fitxa ho diu; un punt fixat a mà que no és la porta porta `approxNote`.
*Per què:* un punt que sembla exacte i no ho és enganya més que dir que és aproximat.
*Comprovació:* `lint-credits.mjs` exigeix `lat`/`lng` a cada mapa; la resta, revisió.

**P9. El tall de la vall no dibuixa el que no s'ha mesurat.** Relleu, vessant i carena
surten de mostres d'EU-DEM; entre dos punts sense mesura no s'hi inventa cap corba.
*Per què:* una línia decorativa es llegeix com a relleu. *Comprovació:*
`build-valley-profile.mjs` peta si un esperó baixa més de 20 m en pujar (ha creuat una
carena) o si la cota d'un poble passa de la carena del seu punt (`SWATH_M` curt).

**P10. Els textos són originals i citen les fonts.** Quan d'una casa no en circula res de
comprovable es marca `dataThin: true` i la fitxa ho diu.
*Per què:* la guia no pot afirmar el que no ha pogut comprovar. *Comprovació:* l'esquema;
el recompte (12 de 44) surt a `/credits`.

**P11. El JSON-LD no diu res que la pàgina no digui.** Cap camp inventat, cap
`aggregateRating` i cap `hours` en prosa.
*Per què:* les notes són de Google, Tripadvisor, Restaurant Guru i la Guia Repsol;
publicar-les com a nostres és el que les directrius de Google prohibeixen i es paga amb una
acció manual. [ADR-0004](docs/adr/0004-cap-aggregaterating.md) *Comprovació:* revisió.

## Codi

**P12. Les URL porten barra final.** Enllaços interns, canòniques, `og:url` i `<loc>`, amb
`build.format: 'directory'` i `trailingSlash: 'ignore'`. Mai es normalitza la barra abans
de comparar.
*Per què:* GitHub Pages respon 301 a la forma sense barra; a masiablanca va deixar 206
pàgines sense indexar. *Comprovació:* `scripts/check-build.mjs` al `npm run check` i a CI,
abans de publicar l'artefacte.

**P13. Res d'estils en línia.** Cada component o pàgina té el seu `.css` al costat, amb
noms de classe bloc-element; colors i mides surten de `tokens.css`. Una pàgina que fa
servir una classe de `directory.css` l'importa.
*Per què:* un sol lloc per a cada estil, i els temes clar i fosc canvien sols.
*Comprovació:* revisió.

**P14. Els scripts `data:*` no corren al build; la seva sortida es commiteja.**
*Per què:* el build és autocontingut —cap secret, cap petició a fora— i reproduïble; les
API externes (OSM, Nominatim, OpenTopoData, Commons) es consulten a mà i amb mesura.
*Comprovació:* `package.json` (cap `data:*` al `prebuild`) i el workflow de desplegament.

## Procés

**P15. Cada coneixement viu al seu fitxer.** Com es treballa → `AGENTS.md`; regles → aquí;
com està fet → `architecture.md`; per què → un ADR; feina → `tasks.md`; risc →
`security.md`.
*Per què:* un diari de sessions al fitxer de l'agent amaga les decisions a qui vingui
després. [ADR-0001](docs/adr/0001-project-knowledge-files.md)
