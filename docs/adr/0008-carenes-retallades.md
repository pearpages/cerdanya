# 0008. Les carenes del tall es retallen dins del marc

- **Data:** 2026-08-10
- **Status:** Proposed

## Context

El tall té tres capes mesurades (fons de vall, vessant, carena). Les carenes arriben a
2.225 m, però tots els pobles viuen entre 1.048 i 1.760 m, i la caixa acaba a 1.850 m
(`ELE_MAX`).

## Decisió

Les carenes surten del marc i es retallen amb un `clipPath`; un degradat que arrenca a
opacitat 0 amaga el tall recte i el fa passar per boira. `ELE_MAX` no s'apuja.

## Conseqüències

+ La franja on viuen els pobles, que és el que el tall ha de deixar llegir, conserva tota
  l'alçada.
− La cota real de les carenes no es llegeix al dibuix.
