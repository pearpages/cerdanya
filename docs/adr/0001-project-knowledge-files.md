# 0001. El coneixement del projecte viu a principles, architecture, decisions, tasks i security

- **Data:** 2026-09-25
- **Status:** Accepted

## Context

Agents i persones han de trobar com es treballa aquí, les regles, com està fet, per què es
va triar cada cosa, què queda obert i quins són els riscos. Deixat anar, tot això s'apila
al fitxer d'instruccions de l'agent com un diari de sessions: `CLAUDE.md` havia arribat a
600 línies, amb regles, arquitectura, pendents i crònica barrejats.

## Decisió

- `AGENTS.md` diu com es treballa aquí i on és cada cosa, i res més. `CLAUDE.md` només
  importa `AGENTS.md` i `principles.md`, perquè Claude Code carregui sempre les regles; la
  resta d'agents llegeixen `AGENTS.md` i en segueixen els enllaços.
- `principles.md`: regles que compleix qualsevol canvi. `architecture.md`: com està fet.
  `decisions.md` + `docs/adr/`: per què. `tasks.md`: Open / Done. `security.md`:
  superfície, secrets, dependències i com avisar. `README.md`: per a qui arriba al repo.
  `LICENSE`, perquè el repo és públic.

## Conseqüències

+ Cada mena de coneixement té una sola casa; qualsevol agent la troba des d'`AGENTS.md`.
+ Els principis són sempre al context de Claude sense duplicar-los.
− Sis fitxers per mantenir al dia; les regles de treball d'`AGENTS.md` fan que actualitzar-los
  formi part de cada canvi.
