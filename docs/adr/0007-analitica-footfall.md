# 0007. Analítica amb footfall, sense galetes

- **Data:** 2026-09-25
- **Status:** Proposed

## Context

No hi havia cap manera de saber si algú llegeix la guia ni què. Les eines habituals
(Google Analytics i similars) posen galetes, envien dades a tercers i obliguen a un bàner
de consentiment i a una política de galetes.

## Decisió

Un sol `<script defer>` de footfall —una instància d'Umami autoallotjada a
`analytics.pearpages.com`— a `BaseLayout.astro`, que és el `<head>` de totes les pàgines.
No desa res al dispositiu i no envia res a tercers.

## Conseqüències

+ Pàgines vistes per ruta, incloses les navegacions del `ClientRouter` (via `pushState`).
+ Sense bàner ni política de galetes: queda dins de l'exempció de mesura d'audiència.
− Una petició a un domini extern a cada pàgina. Si algun dia el lloc publica una política de
  privacitat, ha de dir-ho.
