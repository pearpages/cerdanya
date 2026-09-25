# 0002. MIT per al codi; els textos de les fitxes, reservats

- **Data:** 2026-09-25
- **Status:** Accepted

## Context

El repo és públic a GitHub i no tenia `LICENSE`: el codi es podia llegir però no
reutilitzar. Al repo hi conviuen tres coses de natura diferent: codi (scripts, components,
CSS), textos originals de les fitxes, i fotos i mapes de tercers, cadascun amb la seva
llicència i acreditat a `/credits`.

## Decisió

- El codi va sota llicència MIT.
- Els textos de les fitxes (`src/content/restaurants/*.md`, la prosa) són © pearpages, tots
  els drets reservats.
- Fotos i mapes conserven la llicència del seu autor, que és la que diu `/credits`.

## Conseqüències

+ Qualsevol pot reutilitzar el pipeline (el tall de la vall, els mapes, el comprovador) sense
  preguntar.
+ Les ressenyes, que són la feina editorial, no es poden copiar a una altra guia.
− `LICENSE` ha de dir explícitament què queda fora de la MIT, i el README ho ha de repetir.
