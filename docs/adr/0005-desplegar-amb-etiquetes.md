# 0005. Només es desplega amb una etiqueta v*

- **Data:** 2026-09-25
- **Status:** Proposed

## Context

Fins ara cada `push` a `main` publicava el lloc. Això barreja integrar un canvi amb
publicar-lo, i no deixa cap marca de quina versió és la que hi ha a producció.

## Decisió

`.github/workflows/deploy.yml` corre amb un `push` d'etiquetes `v*`. El `workflow_dispatch`
es manté per tornar a desplegar una versió, però el build només corre si la ref és una
etiqueta `v*`. L'entorn `github-pages` té una política d'etiqueta `v*` al costat de la de
`main`.

## Conseqüències

+ Publicar és un acte explícit, i cada desplegament té una versió.
+ Es pot treballar a `main` sense publicar res a mig fer.
− Un `push` a `main` ja no arriba al lloc: cal recordar-se d'etiquetar.
− La política de l'entorn viu a la configuració de GitHub, fora del repo.
