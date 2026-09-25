# 0006. El crèdit d'autoria del peu surt de @pearpages/credit

- **Data:** 2026-09-09
- **Status:** Proposed

## Context

El peu es feia el seu «Fet per pearpages» a mà, amb una icona a `public/`, i masiablanca en
tenia una altra còpia. Dues còpies se separen.

## Decisió

`<AuthorCredit as="div" />` de `@pearpages/credit`. Les seves variables de color es mapen a
tokens del lloc, i només se'n neutralitzen l'encoixinat i el centrat, fora de `@layer`,
perquè aquí seu en una filera `flex` i no en una banda a tota amplada.

## Conseqüències

+ Una sola font per al crèdit de tots els llocs; zero dependències noves i cap petició
  (la icona va en data URI).
− El rètol és en anglès («Made by pearpages») i el paquet no el deixa canviar: l'arreglada
  és al paquet, no aquí.
− Dues regles que sobreescriuen el paquet, que caldrà revisar si el paquet canvia.
