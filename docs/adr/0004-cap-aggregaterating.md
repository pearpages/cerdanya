# 0004. El JSON-LD no publica cap aggregateRating

- **Data:** 2026-09-09
- **Status:** Proposed

## Context

29 fitxes porten `rating` i la pàgina l'ensenya, però totes les notes són de Google,
Tripadvisor, Restaurant Guru o la Guia Repsol. Un `aggregateRating` al JSON-LD de
`Restaurant` faria sortir estrelles als resultats de cerca.

## Decisió

Cap `aggregateRating`. El JSON-LD no diu res que la pàgina no digui, i la pàgina diu de qui
és cada nota. Tampoc no s'hi publica `hours`, que és prosa catalana i schema.org el vol en
format màquina.

## Conseqüències

+ No es presenten com a pròpies notes d'altres, que és el que les directrius de Google
  prohibeixen i castiguen amb una acció manual.
− Sense estrelles als resultats de cerca.
