# 0003. Els mapes de les fitxes són imatges, no un mapa interactiu

- **Data:** 2026-08-10
- **Status:** Proposed

## Context

La fitxa donava l'adreça en text pla. Faltava ensenyar on és la casa. Un mapa interactiu
(Leaflet, MapLibre, un iframe) vol JS de client i peticions a un servidor de tiles cada cop
que algú llegeix la fitxa.

## Decisió

`scripts/render-maps.mjs` cus els tiles d'OSM (zoom 17, mostrats a mitja mida) en un `.webp`
per fitxa, que es commiteja. Al costat, un enllaç al punt a osm.org i un a Google Maps per
nom i adreça.

## Conseqüències

+ Zero JS i zero peticions externes en llegir una fitxa: el mateix tracte que les fotos.
+ Un sol crèdit d'OSM per als 44 mapes.
− Sense zoom ni desplaçament: qui ho vulgui ha de seguir l'enllaç.
− Un canvi de punt o d'estil vol tornar a passar `data:maps`, amb el cau `data/tiles/`.
