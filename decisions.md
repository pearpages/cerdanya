# Decisions

Registres de decisions d'arquitectura (ADR) de Cota de tast. Cada ADR de `docs/adr/` recull
una tria, el context i el que costa. Les regles que se'n desprenen són a
[principles.md](principles.md).

ADR nou: copia el format de sota, agafa el número següent i afegeix-hi una línia aquí. Un
ADR acceptat no s'edita: desfer-lo vol dir un ADR nou amb estat `Supersedes NNNN`, i el vell
passa a `Superseded by NNNN`. Els ADR es proposen a l'usuari abans d'acceptar-los. Els que
diuen **Proposed** s'han reconstruït de la història del projecte i esperen confirmació.

| # | Decisió | Estat | Data |
|---|---|---|---|
| [0001](docs/adr/0001-project-knowledge-files.md) | El coneixement del projecte viu a principles, architecture, decisions, tasks i security | Accepted | 2026-09-25 |
| [0002](docs/adr/0002-llicencia.md) | MIT per al codi; els textos de les fitxes, reservats | Accepted | 2026-09-25 |
| [0003](docs/adr/0003-mapes-estatics.md) | Els mapes de les fitxes són imatges, no un mapa interactiu | Proposed | 2026-08-10 |
| [0004](docs/adr/0004-cap-aggregaterating.md) | El JSON-LD no publica cap aggregateRating | Proposed | 2026-09-09 |
| [0005](docs/adr/0005-desplegar-amb-etiquetes.md) | Només es desplega amb una etiqueta v* | Proposed | 2026-09-25 |
| [0006](docs/adr/0006-credit-autoria-paquet.md) | El crèdit d'autoria del peu surt de @pearpages/credit | Proposed | 2026-09-09 |
| [0007](docs/adr/0007-analitica-footfall.md) | Analítica amb footfall, sense galetes | Proposed | 2026-09-25 |
| [0008](docs/adr/0008-carenes-retallades.md) | Les carenes del tall es retallen dins del marc | Proposed | 2026-08-10 |

## Format

```md
# NNNN. Títol

- **Data:** AAAA-MM-DD
- **Status:** Proposed | Accepted | Superseded by NNNN

## Context
Què obliga a triar.

## Decisió
Què fem.

## Conseqüències
Què millora (+) i què costa (−).
```
